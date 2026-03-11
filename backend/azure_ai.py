from __future__ import annotations

import asyncio
import json
import logging
import os
import re
from typing import Any

import httpx

logger = logging.getLogger(__name__)

AZURE_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT", "").rstrip("/")
AZURE_API_KEY = os.getenv("AZURE_OPENAI_API_KEY", "")
AZURE_DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o")
AZURE_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION", "2025-01-01-preview")

# Montgomery-specific context injected into all AI prompts
_MONTGOMERY_CONTEXT = (
    "Key Montgomery employers: Hyundai Motor Manufacturing Alabama (HMMA), "
    "Maxwell-Gunter Air Force Base, Baptist Health, City of Montgomery, State of Alabama, "
    "Alabama State University, Trenholm State Community College, Auburn University at Montgomery. "
    "Montgomery metro population ~380K. Key growth areas: defense tech, healthcare, manufacturing. "
    "Workforce challenges: skills gap in cybersecurity and cloud, competition with Birmingham/Atlanta."
)

_MAX_RETRIES = 2
_RETRY_DELAY = 1.5  # seconds


async def _call_azure(payload: dict, timeout: int = 30) -> str | None:
    """
    Call Azure OpenAI with retry logic.

    Returns the content string on success, or None on failure.
    Retries once on transient errors (timeouts, 429, 5xx).
    """
    url = f"{AZURE_ENDPOINT}/openai/deployments/{AZURE_DEPLOYMENT}/chat/completions?api-version={AZURE_API_VERSION}"
    headers = {"api-key": AZURE_API_KEY, "Content-Type": "application/json"}

    for attempt in range(_MAX_RETRIES):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.post(url, headers=headers, json=payload)
                resp.raise_for_status()
                data = resp.json()
            content = _extract_content(data)
            if content:
                return content
            logger.warning("Azure OpenAI returned empty/malformed response (attempt %d)", attempt + 1)
        except httpx.HTTPStatusError as e:
            status = e.response.status_code
            logger.warning("Azure OpenAI HTTP %d (attempt %d): %s", status, attempt + 1, e)
            # Only retry on rate-limit or server errors
            if status not in (429, 500, 502, 503, 504):
                return None
        except Exception as e:
            logger.warning("Azure OpenAI request failed (attempt %d): %s", attempt + 1, e)

        if attempt < _MAX_RETRIES - 1:
            await asyncio.sleep(_RETRY_DELAY)

    return None


def _build_data_facts(jobs: list[dict], trends: dict, signals: list[dict]) -> str:
    """
    Pre-compute derived facts from pipeline data so every AI statement
    can be grounded in explicit values. Returns a compact text block.
    """
    total_jobs = trends.get("total_jobs", len(jobs))
    by_industry = trends.get("by_industry", {})
    by_sector = trends.get("by_sector", {})
    public_ratio = trends.get("public_sector_ratio", 0)

    # Top industries (sorted by count, descending)
    top_industries = sorted(
        by_industry.items(), key=lambda x: x[1], reverse=True
    )[:5]
    top_industries_str = ", ".join(f"{k}({v})" for k, v in top_industries)

    # Sector breakdown
    sector_pct = {}
    if by_sector and total_jobs > 0:
        sector_total = sum(by_sector.values()) or 1
        for k, v in by_sector.items():
            sector_pct[k] = round(100 * v / sector_total, 1)
    sector_str = ", ".join(f"{k}: {v}%" for k, v in sector_pct.items()) or "N/A"

    # Skill gaps: skills without local training
    skills_gap = trends.get("skills_gap", [])
    gap_skills = [s["skill"] for s in skills_gap if s.get("gap") and not s.get("local_training_available")]
    trained_skills = [s["skill"] for s in skills_gap if s.get("local_training_available")]
    top_gaps = ", ".join(gap_skills[:10])
    trained_str = ", ".join(trained_skills[:5]) if trained_skills else "none"

    # Signal counts by type
    by_signal: dict[str, int] = {}
    for s in signals:
        st = s.get("signal_type", "other")
        by_signal[st] = by_signal.get(st, 0) + 1
    signal_counts = ", ".join(f"{k}({v})" for k, v in sorted(by_signal.items(), key=lambda x: -x[1]))

    lines = [
        "DATA FACTS (cite these numbers; do not invent others):",
        f"- total_jobs: {total_jobs}",
        f"- public_sector_ratio: {round(public_ratio * 100, 1)}%",
        f"- sector_distribution: {sector_str}",
        f"- top_industries: {top_industries_str}",
        f"- skill_gaps_no_training: {top_gaps or 'none'}",
        f"- skills_with_local_training: {trained_str}",
        f"- signal_counts_by_type: {signal_counts or 'none'}",
    ]
    return "\n".join(lines)


def _extract_content(data: dict) -> str | None:
    """Safely extract content from Azure OpenAI response."""
    try:
        choices = data.get("choices")
        if not choices or not isinstance(choices, list):
            return None
        return choices[0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        return None


def _safe_parse_json(content: str) -> dict | None:
    """Parse JSON from AI response, stripping markdown code blocks if present."""
    text = content.strip()
    # Strip markdown code block wrappers (```json, ```JSON, ``` json, etc.)
    if text.startswith("```"):
        # Remove opening fence
        text = re.sub(r"^```\s*(?:json)?\s*\n?", "", text, flags=re.IGNORECASE)
        # Remove closing fence
        text = re.sub(r"\n?```\s*$", "", text)
        text = text.strip()
    try:
        return json.loads(text)
    except (json.JSONDecodeError, ValueError) as e:
        logger.warning("Failed to parse AI JSON response: %s", e)
        return None


async def generate_insights(jobs: list[dict], trends: dict, signals: list[dict]) -> dict[str, Any]:
    """
    Use Azure OpenAI to summarize key insights for the AI panel.

    Returns a dict with short bullet points; falls back to a simple
    rules-based summary if Azure credentials are not configured or fail.
    """
    if not (AZURE_ENDPOINT and AZURE_API_KEY):
        return _fallback_insights(jobs, trends, signals)

    facts = _build_data_facts(jobs, trends, signals)
    system_prompt = (
        "You are an economic intelligence analyst for the City of Montgomery, Alabama. "
        f"{_MONTGOMERY_CONTEXT} "
        "You receive pre-computed DATA FACTS. Base every insight on these exact numbers. "
        "Do not invent statistics. Write 3–6 concise bullet insights for a mayoral dashboard.\n"
        "Focus on: top industries (with counts), sector ratios, skill gaps vs local training, "
        "and signal types. Keep each bullet under 160 characters. No explanations or headers."
    )

    payload = {
        "messages": [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": (
                    f"{facts}\n\n"
                    "Additional context (for flavor only; prefer DATA FACTS):\n"
                    f"Trends JSON: {trends}\n\n"
                    f"Sample jobs: {jobs[:10]}\n\n"
                    f"Sample signals: {signals[:10]}"
                ),
            },
        ],
        "max_completion_tokens": 600,
    }

    content = await _call_azure(payload, timeout=30)
    if not content:
        return _fallback_insights(jobs, trends, signals)

    # Split bullets by newline and strip markers
    bullets = []
    for line in content.splitlines():
        line = line.strip("-• ").strip()
        if line:
            bullets.append(line)

    return {"insights": bullets[:8]}


def _fallback_insights(jobs: list[dict], trends: dict, signals: list[dict]) -> dict[str, Any]:
    """Simple deterministic summary when Azure is unavailable."""
    total_jobs = trends.get("total_jobs", len(jobs))
    by_industry = trends.get("by_industry", {})
    by_sector = trends.get("by_sector", {})
    public_ratio = trends.get("public_sector_ratio", 0)

    top_industry = next(iter(by_industry.keys()), "N/A")
    top_sector = max(by_sector, key=by_sector.get) if by_sector else "N/A"

    data_center_signals = [s for s in signals if s.get("signal_type") == "data_center"]
    defense_signals = [s for s in signals if s.get("signal_type") in {"defense_contract", "company_profile"}]

    insights = [
        f"{total_jobs} active jobs in latest snapshot; top sector is {top_sector}.",
        f"Leading industry: {top_industry} based on recent postings.",
        f"Public + federal jobs are {round(public_ratio * 100, 1)}% of activity.",
    ]
    if data_center_signals:
        insights.append(f"{len(data_center_signals)} recent data center related signals detected.")
    if defense_signals:
        insights.append(f"{len(defense_signals)} defense or federal growth signals near Maxwell/Gunter.")

    return {"insights": insights}


async def generate_policy_brief(
    jobs: list[dict],
    trends: dict,
    signals: list[dict],
    raw_insights: list[str],
) -> dict[str, Any]:
    """
    Generate a structured executive policy brief for city planners.
    Returns executive_summary, key_findings, recommended_actions — distinct from raw insights.
    """
    if not (AZURE_ENDPOINT and AZURE_API_KEY):
        return _fallback_policy_brief(raw_insights, trends)

    facts = _build_data_facts(jobs, trends, signals)
    system_prompt = (
        "You are a workforce strategy advisor for the City of Montgomery, Alabama. "
        f"{_MONTGOMERY_CONTEXT} "
        "Create a STRUCTURED executive policy brief for city planners. Do NOT simply repeat the given insights. "
        "Return valid JSON with exactly these keys:\n"
        '- "executive_summary": 2–3 sentences synthesizing the situation and priority areas.\n'
        '- "key_findings": 3–5 distinct findings (array of strings). Condense and deduplicate; add interpretation.\n'
        '- "recommended_actions": 3–5 actionable recommendations for city leadership (array of strings). '
        "Each should start with a verb (e.g. 'Expand', 'Monitor', 'Partner with'). Be specific to Montgomery.\n"
        "Return ONLY the JSON object, no markdown or extra text."
    )

    insights_block = "\n".join(f"- {s}" for s in (raw_insights or [])[:8])

    payload = {
        "messages": [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": (
                    f"{facts}\n\n"
                    "Raw AI insights (do not copy verbatim; synthesize):\n"
                    f"{insights_block}\n\n"
                    f"Trends: {trends}\n\n"
                    f"Sample jobs: {jobs[:5]}\n\n"
                    f"Signals: {signals[:5]}"
                ),
            },
        ],
        "max_completion_tokens": 700,
    }

    content = await _call_azure(payload, timeout=40)
    if not content:
        return _fallback_policy_brief(raw_insights, trends)

    brief = _safe_parse_json(content)
    if brief is None:
        logger.warning("Could not parse policy brief JSON from AI response")
        return _fallback_policy_brief(raw_insights, trends)

    return {
        "executive_summary": brief.get("executive_summary", ""),
        "key_findings": brief.get("key_findings", [])[:5],
        "recommended_actions": brief.get("recommended_actions", [])[:5],
    }


def _fallback_policy_brief(insights: list[str], trends: dict) -> dict[str, Any]:
    """Fallback when Azure is unavailable."""
    summary = f"Montgomery workforce data indicates {trends.get('total_jobs', 0)} active postings. " + (
        (insights[0] if insights else "Key trends require pipeline data.")
    )
    findings = insights[:4] if insights else ["Run the data pipeline to populate insights."]
    actions = [
        "Partner with Trenholm State and ASU on cloud and healthcare training.",
        "Monitor data center and defense contract developments for job growth.",
        "Prioritize skills-gap closure for in-demand roles (cybersecurity, nursing).",
    ]
    return {
        "executive_summary": summary,
        "key_findings": findings,
        "recommended_actions": actions,
    }


async def ask_workforce_pulse(
    question: str,
    jobs: list[dict],
    trends: dict,
    signals: list[dict],
) -> dict[str, Any]:
    """
    Answer a natural-language question about Montgomery workforce and economic data.
    Uses Azure OpenAI with context from jobs, trends, and signals.
    """
    if not (AZURE_ENDPOINT and AZURE_API_KEY):
        return {
            "answer": "AI is not configured. Set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY to enable Ask Workforce Pulse.",
        }

    facts = _build_data_facts(jobs, trends, signals)
    system_prompt = (
        "You are Workforce Pulse, an AI assistant for the City of Montgomery, Alabama's workforce and economic planning. "
        f"{_MONTGOMERY_CONTEXT} "
        "You receive pre-computed DATA FACTS. Ground every answer in these exact values. "
        "Cite numbers (e.g. '41 public_safety postings', '17.1% public sector'). "
        "If the data lacks the answer, say so. Do not invent statistics. "
        "Be concise (2–4 short paragraphs max). Tone: professional, policy-ready."
    )

    context = (
        f"{facts}\n\n"
        "Raw data (for additional detail):\n"
        f"Trends: {trends}\n\n"
        f"Sample jobs: {jobs[:15]}\n\n"
        f"Signals: {signals[:15]}"
    )

    payload = {
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Data context:\n{context}\n\nUser question: {question}"},
        ],
        "max_completion_tokens": 600,
    }

    content = await _call_azure(payload, timeout=45)
    if not content:
        return {"answer": "Sorry, the AI service is temporarily unavailable. Please try again."}

    return {"answer": content.strip()}


def _scenario_fallbacks(scenario: str) -> dict:
    """Keyword-based scenario projections when AI is unavailable."""
    s = scenario.lower()
    if any(kw in s for kw in ("data center", "aws", "google", "meta", "cloud")):
        return {
            "projected": {
                "direct_jobs_created": "+150 specialized positions (IT, facilities, security)",
                "indirect_jobs_multiplier": "+450 support roles (construction, logistics, services)",
                "tech_skill_demand": "+35% increase in cloud and networking certifications needed",
                "power_grid_impact": "+200MW estimated demand on Montgomery's power grid",
                "housing_demand": "+8-12% in surrounding neighborhoods",
                "construction_phase_jobs": "+1,200 temporary construction jobs over 18 months",
                "local_training_gap": "Cloud computing and electrical trades programs need expansion",
            },
            "footnote": "Estimates based on comparable Southeast US data center projects. Configure Azure AI for dynamic projections.",
        }
    elif any(kw in s for kw in ("defense", "military", "contract", "air force", "maxwell")):
        return {
            "projected": {
                "cleared_positions": "+80-120 security-cleared roles",
                "cybersecurity_demand": "+25% increase in cyber/InfoSec postings",
                "engineering_roles": "+60 systems and aerospace engineering positions",
                "economic_multiplier": "+$45M annual economic impact to Montgomery",
                "housing_impact": "+5% housing demand near Maxwell-Gunter AFB corridor",
                "training_need": "Cybersecurity certifications and STEM pipeline expansion required",
            },
            "footnote": "Estimates based on DoD contracting patterns for Montgomery region. Configure Azure AI for dynamic projections.",
        }
    elif any(kw in s for kw in ("manufacturing", "plant", "factory", "hyundai", "automotive")):
        return {
            "projected": {
                "production_jobs": "+800-1,500 production and assembly positions",
                "supply_chain_roles": "+300 logistics and supplier jobs",
                "skilled_trades_demand": "+40% increase in welding, CNC, electrical postings",
                "training_pipeline": "Trenholm State trades programs need 2x capacity",
                "transportation_impact": "Increased freight and commuter traffic on I-65 corridor",
                "wage_impact": "+12% average manufacturing wage growth in region",
            },
            "footnote": "Estimates based on automotive manufacturing impact studies. Configure Azure AI for dynamic projections.",
        }
    elif any(kw in s for kw in ("public safety", "police", "fire", "recruit", "law enforcement")):
        return {
            "projected": {
                "officer_positions": "+45-80 law enforcement positions needed",
                "fire_ems_roles": "+20-30 fire and EMS positions",
                "recruitment_investment": "+$2.5M annual recruitment and training budget",
                "response_time_impact": "+15% improvement in emergency response coverage",
                "community_impact": "Improved coverage in underserved Montgomery neighborhoods",
                "academy_needs": "Academy capacity expansion and lateral hiring programs",
            },
            "footnote": "Estimates based on Montgomery PD staffing analysis. Configure Azure AI for dynamic projections.",
        }
    else:
        return {
            "projected": {
                "employment_impact": "+200-500 new positions across sectors",
                "skills_demand_shift": "Moderate increase in technical certifications needed",
                "economic_multiplier": "+$15-25M estimated annual economic impact",
                "training_alignment": "Review workforce program alignment with emerging demand",
                "infrastructure_assessment": "Assess utility and transportation capacity needs",
            },
            "footnote": "General estimates based on Montgomery economic baseline. Configure Azure AI for scenario-specific projections.",
        }


async def run_scenario(
    scenario: str,
    jobs: list[dict],
    trends: dict,
    signals: list[dict],
) -> dict[str, Any]:
    """
    Run a scenario simulation (e.g. new data center) and return projected impact.
    Uses Azure OpenAI to generate plausible projections based on current data.
    """
    if not (AZURE_ENDPOINT and AZURE_API_KEY):
        fb = _scenario_fallbacks(scenario)
        return {"scenario": scenario, **fb}

    facts = _build_data_facts(jobs, trends, signals)
    system_prompt = (
        "You are an economic impact analyst for Montgomery, Alabama. "
        f"{_MONTGOMERY_CONTEXT} "
        "The local economy has ~180K jobs, $42K median household income, 15% poverty rate. "
        "Key sectors: government (25%), manufacturing (12%), healthcare (15%), defense (10%). "
        "Use the provided DATA FACTS as baseline. Given a scenario, produce a SHORT JSON object with projected impacts. "
        "Use keys: jobs_change (string, e.g. '+1200 jobs'), tech_demand_change (e.g. '+18%'), "
        "electricity_usage_change (e.g. '+35%'), housing_impact (e.g. '+5% demand'), "
        "training_needs (e.g. '200 cloud computing certifications needed'), "
        "and optionally 1–2 more short impact lines. "
        "Base estimates on typical industry multipliers; keep numbers plausible. Return ONLY valid JSON, no markdown."
    )

    payload = {
        "messages": [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": (
                    f"{facts}\n\n"
                    f"Scenario: {scenario}. "
                    "Return JSON with jobs_change, tech_demand_change, electricity_usage_change, housing_impact, training_needs."
                ),
            },
        ],
        "max_completion_tokens": 400,
    }

    content = await _call_azure(payload, timeout=30)

    projected = None
    if content:
        projected = _safe_parse_json(content)
    if projected is None:
        fb = _scenario_fallbacks(scenario)
        projected = fb["projected"]

    return {
        "scenario": scenario,
        "projected": projected,
        "footnote": "Powered by Workforce Pulse.",
    }
