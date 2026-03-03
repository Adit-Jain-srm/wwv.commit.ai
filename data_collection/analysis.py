"""Hiring trend analysis and skills extraction for Workforce Pulse."""

import re
from collections import Counter
from typing import Optional

# Industry keywords mapped to categories (Montgomery-focused)
INDUSTRY_KEYWORDS = {
    "healthcare": ["nurse", "healthcare", "medical", "hospital", "patient", "clinic", "physician", "cna", "lpn"],
    "manufacturing": ["manufacturing", "production", "assembly", "machine operator", "warehouse", "distribution", "logistics"],
    "technology": ["software", "developer", "engineer", "it ", "technology", "data ", "analyst", "tech"],
    "government": ["government", "federal", "state", "city of", "county", "personnel", "deputy", "sheriff"],
    "retail": ["retail", "stocker", "cashier", "sales associate", "store"],
    "hospitality": ["restaurant", "hotel", "food", "kfc", "manager"],
    "education": ["teacher", "education", "school", "instructor", "tutor"],
    "administration": ["administrative", "office", "clerk", "receptionist", "coordinator"],
    "transportation": ["driver", "delivery", "truck", "hazmat", "cdl"],
}

# Common skills/requirements
SKILL_PATTERNS = [
    r"\b(bachelor|associate|master|phd|degree)\b",
    r"\b(certified|certification|license)\b",
    r"\b(experience|years? of)\s+\d+",
    r"\b(entry.?level|mid.?level|senior)\b",
    r"\b(microsoft|excel|word|outlook)\b",
    r"\b(sap|salesforce|quickbooks)\b",
    r"\b(communication|leadership|team)\s*(skills?)?\b",
    r"\b(full.?time|part.?time|contract)\b",
    r"\b(remote|hybrid|on.?site)\b",
    r"\b(cdl|commercial.?driver)\b",
    r"\b(cna|lpn|rn|b\.?s\.?n)\b",
    r"\b(hr|payroll|accounting)\b",
]


def _normalize_job(job: dict) -> dict:
    """Normalize job schema: always use 'url' and standard fields."""
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
        "source": job.get("source") or job.get("source_type", "unknown"),
        "query": job.get("query", ""),
        "collected_at": job.get("collected_at", ""),
    }


def extract_industry(title: str, description: str = "") -> Optional[str]:
    """Classify job into industry based on title and description."""
    text = (title + " " + description).lower()
    scores: dict[str, int] = {}
    for industry, keywords in INDUSTRY_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in text)
        if score > 0:
            scores[industry] = score
    return max(scores, key=scores.get) if scores else None


def extract_skills(title: str, description: str = "") -> list[str]:
    """Extract skill/requirement mentions from job text."""
    text = (title + " " + description).lower()
    skills = []
    for pattern in SKILL_PATTERNS:
        matches = re.findall(pattern, text, re.IGNORECASE)
        skills.extend(m.strip() for m in matches if m and len(str(m).strip()) > 2)
    return list(dict.fromkeys(skills))[:10]


def compute_hiring_trends(jobs: list[dict]) -> dict:
    """Compute hiring trends: industries, top roles, top skills, by-source counts."""
    normalized = [_normalize_job(j) for j in jobs if j.get("title")]

    industries = []
    skills = []
    roles = []

    for j in normalized:
        ind = extract_industry(j["title"], j["description"])
        if ind:
            industries.append(ind)
        sk = extract_skills(j["title"], j["description"])
        skills.extend(sk)
        if j["title"] and len(j["title"]) > 5:
            roles.append(j["title"])

    industry_counts = Counter(industries)
    skill_counts = Counter(skills)
    role_counts = Counter(roles)
    source_counts = Counter(j.get("source", "unknown") for j in normalized)

    return {
        "total_jobs": len(normalized),
        "by_industry": dict(industry_counts.most_common(10)),
        "top_roles": [r for r, _ in role_counts.most_common(15)],
        "in_demand_skills": [s for s, _ in skill_counts.most_common(15)],
        "by_source": dict(source_counts),
    }


def analyze_jobs(jobs: list[dict]) -> tuple[list[dict], dict]:
    """
    Enrich jobs with industry/skills and compute trends.
    Returns (enriched_jobs, trends).
    """
    normalized = [_normalize_job(j) for j in jobs if j.get("title")]
    trends = compute_hiring_trends(normalized)

    for j in normalized:
        j["industry"] = extract_industry(j["title"], j["description"])
        j["skills"] = extract_skills(j["title"], j["description"])

    return normalized, trends
