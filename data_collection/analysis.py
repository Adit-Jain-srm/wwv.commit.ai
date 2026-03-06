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

# Federal checked first (more specific) to prevent federal jobs
# mentioning "public" from being misclassified as public sector.
# Bare "public" removed — too broad (matches "public speaking" etc.)
SECTOR_RULES = [
    ("federal", [
        "federal", "usajobs", "air force", "maxwell", "gunter",
        "department of defense", "dod", "va ", "veterans affairs",
        "fbi", "irs", "usps", "postal", "social security",
    ]),
    ("public", [
        "city of montgomery", "state of alabama", "county government",
        "municipal", "public sector", "public administration",
        "personnel board", "planning department", "public works",
        "housing authority", "school district", "public safety",
        "alabama state university", "auburn university at montgomery",
        "government jobs", "civil service",
    ]),
]

# ── Skill extraction ─────────────────────────────────────────────

# ── Title validation (filter UI navigation junk from scraped pages) ─

TITLE_BLOCKLIST = {
    "skip to main content", "sign in", "sign up", "log in", "register",
    "employers / post job", "post a job", "upload your resume",
    "upload resume", "view similar jobs with this employer",
    "resume resources:", "career resources:", "employer resources:",
    "job post details", "profile insights", "job details", "job type",
    "benefits", "full job description", "about the company",
    "company overview", "how to apply", "search results", "search jobs",
    "find jobs", "browse jobs", "back to search", "next page",
    "previous page", "show more", "load more", "see all jobs",
    "similar jobs", "related searches", "jobs in montgomery, al",
    "refine your search", "people also searched", "popular searches",
    "create job alert", "save this job", "report job", "apply now",
}

TITLE_BLOCKLIST_PATTERNS = [
    re.compile(r"^skip to "),
    re.compile(r"^sign (in|up|out)"),
    re.compile(r"^log (in|out)"),
    re.compile(r"resources:$"),
    re.compile(r"- job post$"),
    re.compile(r"^\*\*your impact"),
    re.compile(r"^cookie"),
    re.compile(r"^accept all"),
    re.compile(r"^privacy"),
    re.compile(r"^terms "),
    re.compile(r"^we use "),
]

_SECTION_HEADERS = {
    "skills", "education", "benefits", "location", "salary", "overview",
    "description", "requirements", "qualifications", "about", "apply",
    "summary", "responsibilities", "duties", "experience",
}


def _is_valid_job_title(title: str) -> bool:
    """Return False if title looks like UI navigation rather than a real job posting."""
    if not title or len(title) < 4:
        return False
    t = title.strip()
    t_lower = t.lower()
    if t_lower in TITLE_BLOCKLIST:
        return False
    for pattern in TITLE_BLOCKLIST_PATTERNS:
        if pattern.match(t_lower):
            return False
    if t_lower in _SECTION_HEADERS:
        return False
    if not any(c.isalpha() for c in t):
        return False
    return True

SKILL_PATTERNS = [
    re.compile(r"\b(bachelor|associate degree|master|phd|degree|diploma|ged)\b", re.IGNORECASE),
    re.compile(r"\b(certification|security clearance|top secret|secret clearance)\b", re.IGNORECASE),
    re.compile(r"\b(microsoft|excel|word|outlook|powerpoint)\b", re.IGNORECASE),
    re.compile(r"\b(sap|salesforce|quickbooks|oracle|peoplesoft)\b", re.IGNORECASE),
    re.compile(r"\b(python|java|sql|javascript|cloud|aws|azure)\b", re.IGNORECASE),
    re.compile(r"\b(communication skills|leadership skills|teamwork)\b", re.IGNORECASE),
    re.compile(r"\b(cdl|commercial.?driver)\b", re.IGNORECASE),
    re.compile(r"\b(cna|lpn|rn|b\.?s\.?n|paramedic|emt)\b", re.IGNORECASE),
    re.compile(r"\b(hr|payroll|accounting|budgeting)\b", re.IGNORECASE),
    re.compile(r"\b(bilingual|spanish)\b", re.IGNORECASE),
    re.compile(r"\b(project management|pmp|scrum|agile)\b", re.IGNORECASE),
    re.compile(r"\b(hvac|welding|plumbing|electrical)\b", re.IGNORECASE),
    re.compile(r"\b(data analysis|analytics|tableau|power bi)\b", re.IGNORECASE),
    re.compile(r"\b(customer service|case management|data entry)\b", re.IGNORECASE),
    re.compile(r"\b(forklift|cnc|autocad|gis)\b", re.IGNORECASE),
    re.compile(r"\b(first aid|cpr|osha)\b", re.IGNORECASE),
    re.compile(r"\b(social media|marketing|procurement)\b", re.IGNORECASE),
    re.compile(r"\b(nursing|medical coding|phlebotomy)\b", re.IGNORECASE),
    re.compile(r"\b(cybersecurity|cyber security|information security)\b", re.IGNORECASE),
    re.compile(r"\b(machine learning|artificial intelligence|deep learning)\b", re.IGNORECASE),
    re.compile(r"\b(drone|uas|unmanned)\b", re.IGNORECASE),
    re.compile(r"\b(logistics management|supply chain management)\b", re.IGNORECASE),
    re.compile(r"\b(devops|kubernetes|docker|terraform)\b", re.IGNORECASE),
    re.compile(r"\b(registered nurse|licensed practical nurse)\b", re.IGNORECASE),
]

# Words that regex may capture but are NOT skills — they are seniority levels,
# job modalities, or work arrangements.  Filtered in extract_skills().
NON_SKILLS = {
    "manager", "senior", "supervisor", "associate", "director",
    "coordinator", "specialist", "assistant", "intern", "lead",
    "part-time", "part time", "full-time", "full time",
    "contract", "temporary", "remote", "hybrid", "onsite",
    "on-site", "on site", "telework", "telecommute",
    "entry-level", "entry level", "mid-level", "mid level",
    "team", "certified", "license", "experience",
}


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
    """Classify job as federal / public / private sector."""
    text = f"{title} {company} {description} {source}".lower()
    for sector, keywords in SECTOR_RULES:
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
    """Extract skill and requirement mentions, excluding non-skills."""
    text = (title + " " + description[:2000]).lower()
    skills = []
    for pattern in SKILL_PATTERNS:
        matches = pattern.findall(text)
        for m in matches:
            val = m if isinstance(m, str) else m[0] if m else ""
            val = val.strip()
            if val and len(val) > 2 and val.lower() not in NON_SKILLS:
                skills.append(val)
    return list(dict.fromkeys(skills))[:12]


def extract_experience_level(title: str, description: str = "") -> str:
    """Classify job by experience level (repurposed from skill patterns)."""
    text = (title + " " + description).lower()
    if any(kw in text for kw in ["entry level", "entry-level", "junior", "intern", "trainee"]):
        return "entry"
    if any(kw in text for kw in ["senior", "sr.", "lead", "principal", "staff"]):
        return "senior"
    if any(kw in text for kw in ["manager", "director", "vp", "chief", "head of"]):
        return "management"
    return "mid"


def extract_work_arrangement(title: str, description: str = "") -> str:
    """Classify work arrangement (repurposed from skill patterns)."""
    text = (title + " " + description).lower()
    if any(kw in text for kw in ["remote", "telework", "telecommute", "work from home"]):
        return "remote"
    if "hybrid" in text:
        return "hybrid"
    return "onsite"


def parse_salary(pay_str: str) -> tuple[float, float] | None:
    """Parse salary string into (min_annual, max_annual). Returns None if unparseable."""
    if not pay_str:
        return None
    text = str(pay_str).lower().replace(",", "").replace("$", "").strip()
    if not text:
        return None

    # Hourly: "$25/hour", "$25 per hour", "$25 an hour"
    hourly = re.search(r"(\d+(?:\.\d+)?)\s*(?:per|/|an?)\s*h(?:ou)?r", text)
    if hourly:
        rate = float(hourly.group(1))
        annual = rate * 2080
        return (annual, annual)

    # Annual range: "50000 - 70000", "50k-70k", "50000 to 70000"
    nums = re.findall(r"(\d+(?:\.\d+)?)\s*k?", text)
    if len(nums) >= 2:
        vals = []
        for n in nums[:2]:
            v = float(n)
            if v < 1000:
                v *= 1000  # "50k" → 50000
            vals.append(v)
        return (min(vals), max(vals))
    if len(nums) == 1:
        v = float(nums[0])
        if v < 1000:
            v *= 1000
        if v >= 15000:  # plausible annual salary
            return (v, v)

    return None


# Synonym mapping: extracted skill → local training field equivalents
_SKILL_SYNONYMS: dict[str, list[str]] = {
    "aws": ["cloud computing", "information technology", "computer science"],
    "azure": ["cloud computing", "information technology", "computer science"],
    "cloud": ["cloud computing", "information technology", "computer science"],
    "python": ["computer science", "information technology", "data science"],
    "java": ["computer science", "information technology", "software"],
    "javascript": ["computer science", "information technology", "web development"],
    "sql": ["computer science", "information technology", "data science"],
    "cybersecurity": ["cybersecurity", "information technology", "computer science"],
    "cyber security": ["cybersecurity", "information technology", "computer science"],
    "information security": ["cybersecurity", "information technology"],
    "rn": ["nursing", "registered nursing"],
    "lpn": ["nursing", "licensed practical nursing"],
    "cna": ["nursing", "certified nursing"],
    "registered nurse": ["nursing", "registered nursing"],
    "licensed practical nurse": ["nursing", "licensed practical nursing"],
    "nursing": ["nursing", "registered nursing"],
    "medical coding": ["health information", "medical coding"],
    "phlebotomy": ["phlebotomy", "clinical laboratory"],
    "emt": ["emergency medical", "paramedicine"],
    "paramedic": ["emergency medical", "paramedicine"],
    "hvac": ["hvac", "mechanical", "trades"],
    "welding": ["welding", "trades"],
    "electrical": ["electrical", "trades"],
    "cdl": ["commercial driving", "transportation"],
    "machine learning": ["computer science", "data science", "artificial intelligence"],
    "artificial intelligence": ["computer science", "data science", "artificial intelligence"],
    "data analysis": ["data science", "statistics", "business analytics"],
    "analytics": ["data science", "statistics", "business analytics"],
    "project management": ["business administration", "project management"],
    "agile": ["computer science", "project management"],
    "scrum": ["computer science", "project management"],
    "devops": ["computer science", "information technology"],
    "kubernetes": ["computer science", "information technology"],
    "docker": ["computer science", "information technology"],
    "drone": ["unmanned systems", "aviation"],
    "logistics management": ["logistics", "supply chain", "business"],
    "supply chain management": ["logistics", "supply chain", "business"],
}


def detect_skills_gap(in_demand_skills: list[str]) -> list[dict]:
    """
    Compare in-demand skills against local education programs.
    Uses synonym mapping for better matching accuracy.
    Returns skills that are in demand but may lack local training supply.
    """
    gaps = []
    local_lower = {f.lower() for f in LOCAL_DEGREE_FIELDS}

    for skill in in_demand_skills:
        skill_lower = skill.lower()
        # Check direct substring match
        has_local = any(
            skill_lower in field or field in skill_lower
            for field in local_lower
        )
        # Check synonym-based match
        if not has_local:
            synonyms = _SKILL_SYNONYMS.get(skill_lower, [])
            has_local = any(
                syn.lower() in field or field in syn.lower()
                for syn in synonyms
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
    experience_levels = []
    work_arrangements = []
    salary_by_industry: dict[str, list[float]] = {}

    for j in normalized:
        if not _is_valid_job_title(j["title"]):
            continue
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
        experience_levels.append(extract_experience_level(j["title"], j["description"]))
        work_arrangements.append(extract_work_arrangement(j["title"], j["description"]))
        sal = parse_salary(j.get("pay", ""))
        if sal and ind:
            mid = (sal[0] + sal[1]) / 2
            salary_by_industry.setdefault(ind, []).append(mid)

    industry_counts = Counter(industries)
    sector_counts = Counter(sectors)
    skill_counts = Counter(skills_list)
    role_counts = Counter(roles)
    company_counts = Counter(companies)
    source_counts = Counter(j.get("source", "unknown") for j in normalized)
    experience_counts = Counter(experience_levels)
    arrangement_counts = Counter(work_arrangements)

    top_skills = [s for s, _ in skill_counts.most_common(20)]
    gaps = detect_skills_gap(top_skills)

    # Compute median salary by industry
    median_salary = {}
    for ind, salaries in salary_by_industry.items():
        if salaries:
            sorted_s = sorted(salaries)
            mid_idx = len(sorted_s) // 2
            median_salary[ind] = round(sorted_s[mid_idx])

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
        "by_experience_level": dict(experience_counts),
        "by_work_arrangement": dict(arrangement_counts),
        "median_salary_by_industry": median_salary,
    }


def analyze_jobs(jobs: list[dict]) -> tuple[list[dict], dict]:
    """
    Enrich each job with industry, sector, skills.
    Compute Montgomery-aligned trends.
    Returns (enriched_jobs, trends).
    """
    normalized = [
        _normalize_job(j) for j in jobs
        if j.get("title") and _is_valid_job_title(str(j.get("title", "")))
    ]

    for j in normalized:
        j["industry"] = extract_industry(j["title"], j["description"])
        j["sector"] = classify_sector(j["title"], j["company"], j["description"], j["source"])
        j["skills"] = extract_skills(j["title"], j["description"])
        j["experience_level"] = extract_experience_level(j["title"], j["description"])
        j["work_arrangement"] = extract_work_arrangement(j["title"], j["description"])

    trends = compute_hiring_trends(normalized)
    return normalized, trends