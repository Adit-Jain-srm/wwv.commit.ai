"""
Workforce Pulse — Analysis Engine

Montgomery-aligned industry classification, sector tagging,
skills gap detection, and policy-ready trend computation.
"""

import re
from collections import Counter
from typing import Optional

from .config import LOCAL_DEGREE_FIELDS

# ── Industry classification (Montgomery economic structure) ──────
# Ordered by importance to Montgomery's economy per workshop insights.

INDUSTRY_KEYWORDS: dict[str, list[str]] = {
    "government": [
        "government", "state of alabama", "city of montgomery", "county",
        "municipal", "public administration", "personnel", "civil service",
        "planning department", "public works", "housing authority",
    ],
    "defense_federal": [
        "air force", "maxwell", "gunter", "military", "defense",
        "federal", "dod", "department of defense", "contractor",
        "usaf", "armed forces", "veteran", "security clearance",
    ],
    "public_safety": [
        "police", "fire", "ems", "sheriff", "deputy", "corrections",
        "dispatch", "public safety", "law enforcement", "officer",
    ],
    "healthcare": [
        "nurse", "healthcare", "medical", "hospital", "patient",
        "clinic", "physician", "cna", "lpn", "rn", "baptist health",
        "jackson hospital", "pharmacy", "dental", "therapist",
    ],
    "manufacturing": [
        "manufacturing", "production", "assembly", "hyundai", "plant",
        "machine operator", "warehouse", "distribution", "logistics",
        "supply chain", "quality control", "welding",
    ],
    "technology": [
        "software", "developer", "data center", "cloud", "aws", "google",
        "meta", "it ", "information technology", "data analyst",
        "cybersecurity", "network", "systems admin", "devops", "ai ",
    ],
    "education": [
        "teacher", "education", "school", "instructor", "professor",
        "alabama state university", "auburn university", "troy",
        "trenholm", "faulkner", "huntingdon", "tutor", "academic",
    ],
    "retail_hospitality": [
        "retail", "stocker", "cashier", "sales associate", "store",
        "restaurant", "hotel", "food service", "cook", "server",
    ],
    "transportation": [
        "driver", "delivery", "truck", "hazmat", "cdl", "transit",
        "bus", "freight", "shipping",
    ],
    "construction_trades": [
        "construction", "electrician", "plumber", "hvac", "carpenter",
        "maintenance", "mechanic", "building", "facilities",
    ],
}

# ── Sector classification (public vs private vs federal) ─────────

SECTOR_RULES: dict[str, list[str]] = {
    "public": [
        "city of montgomery", "state of alabama", "county", "municipal",
        "government", "public", "personnel board", "planning department",
        "housing authority", "public works", "school district",
        "alabama state university", "auburn university at montgomery",
    ],
    "federal": [
        "federal", "usajobs", "air force", "maxwell", "gunter",
        "department of defense", "dod", "va ", "veterans affairs",
        "fbi", "irs", "usps", "postal", "social security",
    ],
    "private": [],  # default fallback
}

# ── Skill extraction ─────────────────────────────────────────────

SKILL_PATTERNS = [
    r"\b(bachelor|associate|master|phd|degree|diploma|ged)\b",
    r"\b(certified|certification|license|clearance)\b",
    r"\b(experience)\b.*?\b(\d+)\s*(?:year|yr)",
    r"\b(entry.?level|mid.?level|senior|supervisor|manager)\b",
    r"\b(microsoft|excel|word|outlook|powerpoint)\b",
    r"\b(sap|salesforce|quickbooks|oracle|peoplesoft)\b",
    r"\b(python|java|sql|javascript|cloud|aws)\b",
    r"\b(communication|leadership|team)\s*(skills?)?\b",
    r"\b(full.?time|part.?time|contract|temporary)\b",
    r"\b(remote|hybrid|on.?site|telework)\b",
    r"\b(cdl|commercial.?driver)\b",
    r"\b(cna|lpn|rn|b\.?s\.?n|paramedic|emt)\b",
    r"\b(hr|payroll|accounting|budgeting)\b",
    r"\b(security clearance|secret|top secret)\b",
    r"\b(bilingual|spanish)\b",
    r"\b(project management|pmp|scrum|agile)\b",
    r"\b(hvac|welding|plumbing|electrical)\b",
    r"\b(data analysis|analytics|tableau|power bi)\b",
]


def _normalize_job(job: dict) -> dict:
    """Normalize job schema with Montgomery-relevant fields."""
    title = job.get("title") or job.get("name", "")
    url = job.get("url") or job.get("link", "")
    return {
        "title": str(title).strip(),
        "url": str(url).strip(),
        "company": str(job.get("company", "")).strip(),
        "location": str(job.get("location", "")).strip(),
        "description": str(job.get("description", "")).strip(),
        "pay": str(job.get("pay", "")).strip(),
        "posted": str(job.get("posted", "")).strip(),
        "job_type": str(job.get("job_type", "")).strip(),
        "department": str(job.get("department", "")).strip(),
        "source": job.get("source") or job.get("source_type", "unknown"),
        "query": job.get("query", ""),
        "collected_at": job.get("collected_at", ""),
    }


def classify_sector(title: str, company: str = "", description: str = "", source: str = "") -> str:
    """Classify job as public / federal / private sector."""
    text = f"{title} {company} {description} {source}".lower()
    for sector, keywords in SECTOR_RULES.items():
        if sector == "private":
            continue
        if any(kw in text for kw in keywords):
            return sector
    return "private"


def extract_industry(title: str, description: str = "") -> Optional[str]:
    """Classify job into Montgomery-aligned industry."""
    text = (title + " " + description).lower()
    scores: dict[str, int] = {}
    for industry, keywords in INDUSTRY_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in text)
        if score > 0:
            scores[industry] = score
    return max(scores, key=scores.get) if scores else None


def extract_skills(title: str, description: str = "") -> list[str]:
    """Extract skill and requirement mentions."""
    text = (title + " " + description).lower()
    skills = []
    for pattern in SKILL_PATTERNS:
        matches = re.findall(pattern, text, re.IGNORECASE)
        for m in matches:
            val = m if isinstance(m, str) else m[0] if m else ""
            val = val.strip()
            if val and len(val) > 2:
                skills.append(val)
    return list(dict.fromkeys(skills))[:12]


def detect_skills_gap(in_demand_skills: list[str]) -> list[dict]:
    """
    Compare in-demand skills against local education programs.
    Returns skills that are in demand but may lack local training supply.
    """
    gaps = []
    local_lower = {f.lower() for f in LOCAL_DEGREE_FIELDS}

    for skill in in_demand_skills:
        skill_lower = skill.lower()
        has_local = any(
            skill_lower in field or field in skill_lower
            for field in local_lower
        )
        gaps.append({
            "skill": skill,
            "local_training_available": has_local,
            "gap": not has_local,
        })
    return gaps


def compute_hiring_trends(jobs: list[dict]) -> dict:
    """
    Compute policy-ready hiring trends:
      - by_industry (Montgomery-aligned)
      - by_sector (public / federal / private)
      - top_roles, top_companies, in_demand_skills
      - skills_gap analysis
      - by_source
    """
    normalized = [_normalize_job(j) for j in jobs if j.get("title")]

    industries = []
    sectors = []
    skills_list = []
    roles = []
    companies = []

    for j in normalized:
        ind = extract_industry(j["title"], j["description"])
        if ind:
            industries.append(ind)
        sec = classify_sector(j["title"], j["company"], j["description"], j["source"])
        sectors.append(sec)
        sk = extract_skills(j["title"], j["description"])
        skills_list.extend(sk)
        if j["title"] and len(j["title"]) > 5:
            roles.append(j["title"])
        if j["company"] and len(j["company"]) > 2:
            companies.append(j["company"])

    industry_counts = Counter(industries)
    sector_counts = Counter(sectors)
    skill_counts = Counter(skills_list)
    role_counts = Counter(roles)
    company_counts = Counter(companies)
    source_counts = Counter(j.get("source", "unknown") for j in normalized)

    top_skills = [s for s, _ in skill_counts.most_common(20)]
    gaps = detect_skills_gap(top_skills)

    return {
        "total_jobs": len(normalized),
        "by_industry": dict(industry_counts.most_common(12)),
        "by_sector": dict(sector_counts),
        "public_sector_ratio": round(
            (sector_counts.get("public", 0) + sector_counts.get("federal", 0))
            / max(len(normalized), 1), 3
        ),
        "top_roles": [r for r, _ in role_counts.most_common(20)],
        "top_companies": [c for c, _ in company_counts.most_common(15)],
        "in_demand_skills": top_skills,
        "skills_gap": gaps,
        "by_source": dict(source_counts),
    }


def analyze_jobs(jobs: list[dict]) -> tuple[list[dict], dict]:
    """
    Enrich each job with industry, sector, skills.
    Compute Montgomery-aligned trends.
    Returns (enriched_jobs, trends).
    """
    normalized = [_normalize_job(j) for j in jobs if j.get("title")]

    for j in normalized:
        j["industry"] = extract_industry(j["title"], j["description"])
        j["sector"] = classify_sector(j["title"], j["company"], j["description"], j["source"])
        j["skills"] = extract_skills(j["title"], j["description"])

    trends = compute_hiring_trends(normalized)
    return normalized, trends
