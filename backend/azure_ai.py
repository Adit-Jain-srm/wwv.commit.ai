from __future__ import annotations

import json
import os
from typing import Any

import httpx


AZURE_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT", "").rstrip("/")
AZURE_API_KEY = os.getenv("AZURE_OPENAI_API_KEY", "")
AZURE_DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o")
AZURE_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION", "2025-01-01-preview")


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
        for k, v in by_sector.items():
            sector_pct[k] = round(100 * v / sum(by_sector.values()), 1)
    sector_str = ", ".join(f"{k}: {v}%" for k, v in sector_pct.items()) or "N/A"

    # Skill gaps: skills without local training
    skills_gap = trends.get("skills_gap", [])
    gap_skills = [s["skill"] for s in skills_gap if s.get("gap") and not s.get("local_training_available")]
    trained_skills = [s["skill"] for s in skills_gap if s.get("local_training_available")]
    top_gaps = ", ".join(gap_skills[:10])
    trained_str = ", ".join(trained_skills[:5]) if trained_skills else "none"

    # Signal counts by type
    by_signal = {}
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
        "temperature": 0.2,
        "max_tokens": 400,
    }

    url = f"{AZURE_ENDPOINT}/openai/deployments/{AZURE_DEPLOYMENT}/chat/completions?api-version={AZURE_API_VERSION}"

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                url,
                headers={"api-key": AZURE_API_KEY, "Content-Type": "application/json"},
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
    except Exception:
        return _fallback_insights(jobs, trends, signals)

    try:
        content = data["choices"][0]["message"]["content"]
    except Exception:
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

    system_prompt = (
        "You are a workforce strategy advisor for the City of Montgomery, Alabama. "
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
                    "Raw AI insights (do not copy verbatim; synthesize):\n"
                    f"{insights_block}\n\n"
                    f"Trends: {trends}\n\n"
                    f"Sample jobs: {jobs[:5]}\n\n"
                    f"Signals: {signals[:5]}"
                ),
            },
        ],
        "temperature": 0.3,
        "max_tokens": 700,
    }

    url = f"{AZURE_ENDPOINT}/openai/deployments/{AZURE_DEPLOYMENT}/chat/completions?api-version={AZURE_API_VERSION}"

    try:
        async with httpx.AsyncClient(timeout=40) as client:
            resp = await client.post(
                url,
                headers={"api-key": AZURE_API_KEY, "Content-Type": "application/json"},
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
    except Exception:
        return _fallback_policy_brief(raw_insights, trends)

    try:
        content = data["choices"][0]["message"]["content"].strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1] if "\n" in content else content
            content = content.replace("```json", "").replace("```", "").strip()
        brief = json.loads(content)
        return {
            "executive_summary": brief.get("executive_summary", ""),
            "key_findings": brief.get("key_findings", [])[:5],
            "recommended_actions": brief.get("recommended_actions", [])[:5],
        }
    except Exception:
        return _fallback_policy_brief(raw_insights, trends)


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
        "temperature": 0.3,
        "max_tokens": 600,
    }

    url = f"{AZURE_ENDPOINT}/openai/deployments/{AZURE_DEPLOYMENT}/chat/completions?api-version={AZURE_API_VERSION}"

    try:
        async with httpx.AsyncClient(timeout=45) as client:
            resp = await client.post(
                url,
                headers={"api-key": AZURE_API_KEY, "Content-Type": "application/json"},
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        return {"answer": f"Sorry, the AI service is temporarily unavailable: {e!s}"}

    try:
        content = data["choices"][0]["message"]["content"]
    except Exception:
        return {"answer": "Could not parse the AI response."}

    return {"answer": content.strip()}


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
        return {
            "scenario": scenario,
            "projected": {
                "jobs_change": "+1200 (example; configure AI for real projections)",
                "tech_demand_change": "+18%",
                "electricity_usage_change": "+35%",
            },
            "footnote": "Powered by Workforce Pulse.",
        }

    facts = _build_data_facts(jobs, trends, signals)
    system_prompt = (
        "You are an economic impact analyst for Montgomery, Alabama. "
        "Use the provided DATA FACTS as baseline. Given a scenario, produce a SHORT JSON object with projected impacts. "
        "Use keys: jobs_change (string, e.g. '+1200 jobs'), tech_demand_change (e.g. '+18%'), "
        "electricity_usage_change (e.g. '+35%'), and optionally 1–2 more short impact lines. "
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
                    "Return JSON with jobs_change, tech_demand_change, electricity_usage_change."
                ),
            },
        ],
        "temperature": 0.4,
        "max_tokens": 300,
    }

    url = f"{AZURE_ENDPOINT}/openai/deployments/{AZURE_DEPLOYMENT}/chat/completions?api-version={AZURE_API_VERSION}"

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                url,
                headers={"api-key": AZURE_API_KEY, "Content-Type": "application/json"},
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
    except Exception:
        return {
            "scenario": scenario,
            "projected": {
                "jobs_change": "+1200 jobs",
                "tech_demand_change": "+18%",
                "electricity_usage_change": "+35%",
            },
            "footnote": "Service temporarily unavailable; showing example projections.",
        }

    try:
        content = data["choices"][0]["message"]["content"].strip()
        # Strip markdown code block if present
        if content.startswith("```"):
            content = content.split("\n", 1)[1] if "\n" in content else content
            content = content.replace("```json", "").replace("```", "").strip()
        projected = json.loads(content)
    except Exception:
        projected = {
            "jobs_change": "+1200 jobs",
            "tech_demand_change": "+18%",
            "electricity_usage_change": "+35%",
        }

    return {
        "scenario": scenario,
        "projected": projected,
        "footnote": "Powered by Workforce Pulse.",
    }

