"""
Job postings collector — PRO_MODE.

Data sources (priority order):
  1. LinkedIn structured API (web_data_linkedin_job_listings)
  2. AI extract from Indeed / JobAps (structured JSON)
  3. SERP search (Google Jobs widget + organic)
  4. Job board markdown scraping (fallback)
"""

import json
import logging
import re
from datetime import datetime, timezone

from ..analysis import analyze_jobs
from ..brightdata_client import BrightDataClient
from ..config import (
    DATA_DIR,
    EXTRACT_JOB_URLS,
    GEO_LOCATION,
    JOB_BOARDS,
    JOB_SEARCH_QUERIES,
    LINKEDIN_JOB_URLS,
)

logger = logging.getLogger(__name__)


async def collect_jobs(client: BrightDataClient) -> list[dict]:
    """
    Full job collection pipeline:
      Phase 1 — LinkedIn structured job data
      Phase 2 — AI extract from job boards
      Phase 3 — SERP search
      Phase 4 — Markdown scrape fallback
      Phase 5 — Deduplicate, analyze, save
    """
    all_jobs: list[dict] = []
    timestamp = datetime.now(timezone.utc).isoformat()

    # ── Phase 1: LinkedIn structured data ────────────────────────
    logger.info("Phase 1: LinkedIn structured job listings...")
    for url in LINKEDIN_JOB_URLS:
        try:
            data = await client.linkedin_job_listing(url)
            parsed = _parse_linkedin_jobs(data, url, timestamp)
            logger.info("  %s → %d jobs", _short_url(url), len(parsed))
            all_jobs.extend(parsed)
        except Exception as e:
            logger.warning("  LinkedIn structured failed for %s: %s", _short_url(url), e)

    # ── Phase 2: AI extract from job boards ──────────────────────
    logger.info("Phase 2: AI-powered extraction from job boards...")
    for url, prompt in EXTRACT_JOB_URLS:
        try:
            result = await client.extract(url, prompt)
            if isinstance(result, (dict, list)):
                parsed = _parse_extracted_json(result, url)
            else:
                parsed = _extract_jobs_from_markdown(str(result), url)
            for j in parsed:
                j["source"] = "ai_extract"
                j["collected_at"] = timestamp
            logger.info("  %s → %d jobs", _short_url(url), len(parsed))
            all_jobs.extend(parsed)
        except Exception as e:
            logger.warning("  AI extract failed for %s: %s", _short_url(url), e)

    # ── Phase 3: SERP search ─────────────────────────────────────
    logger.info("Phase 3: SERP search across %d queries...", len(JOB_SEARCH_QUERIES))
    search_results = await client.search_all(JOB_SEARCH_QUERIES, country=GEO_LOCATION)
    for query, results in search_results.items():
        for r in results:
            all_jobs.append({
                "title": r.get("title", ""),
                "url": r.get("url") or r.get("link", ""),
                "description": r.get("description", ""),
                "source": "serp",
                "query": query,
                "collected_at": timestamp,
            })
    logger.info("  SERP yielded %d raw entries", sum(len(v) for v in search_results.values()))

    # ── Phase 4: Markdown scrape fallback ────────────────────────
    logger.info("Phase 4: Scraping %d job boards...", len(JOB_BOARDS))
    for board_url in JOB_BOARDS:
        try:
            markdown = await client.scrape_page(board_url)
            parsed = _extract_jobs_from_markdown(markdown, board_url)
            for j in parsed:
                j["source"] = "job_board"
                j["collected_at"] = timestamp
                j["url"] = j.get("url") or j.get("link", "")
            logger.info("  %s → %d jobs", _short_url(board_url), len(parsed))
            all_jobs.extend(parsed)
        except Exception as e:
            logger.error("  FAILED to scrape %s: %s", _short_url(board_url), e)

    # ── Phase 5: Deduplicate, analyze, save ──────────────────────
    all_jobs = _deduplicate(all_jobs)
    logger.info("Total unique jobs: %d", len(all_jobs))

    enriched_jobs, trends = analyze_jobs(all_jobs)
    top3 = list(trends.get("by_industry", {}).keys())[:3]
    logger.info("Top industries: %s", top3)

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    (DATA_DIR / f"jobs_{ts}.json").write_text(json.dumps(enriched_jobs, indent=2), encoding="utf-8")
    (DATA_DIR / "jobs_latest.json").write_text(json.dumps(enriched_jobs, indent=2), encoding="utf-8")
    (DATA_DIR / "trends_latest.json").write_text(json.dumps(trends, indent=2), encoding="utf-8")
    logger.info("Saved jobs + trends to data/")

    return enriched_jobs


# ── Parsing helpers ──────────────────────────────────────────────

def _parse_linkedin_jobs(data, source_url: str, timestamp: str) -> list[dict]:
    """Parse LinkedIn structured API response into normalized jobs."""
    jobs = []
    items = data if isinstance(data, list) else [data] if isinstance(data, dict) else []

    for item in items:
        if not isinstance(item, dict):
            continue
        title = item.get("title") or item.get("job_title") or item.get("name", "")
        if not title:
            continue
        jobs.append({
            "title": str(title),
            "url": item.get("url") or item.get("link") or source_url,
            "company": item.get("company") or item.get("company_name", ""),
            "location": item.get("location", ""),
            "description": str(item.get("description", ""))[:500],
            "pay": item.get("salary") or item.get("compensation", ""),
            "posted": item.get("posted_date") or item.get("posted", ""),
            "job_type": item.get("employment_type") or item.get("job_type", ""),
            "source": "linkedin_structured",
            "collected_at": timestamp,
        })

    return jobs


def _parse_extracted_json(data, source_url: str) -> list[dict]:
    """Parse structured JSON returned by AI extraction into job dicts."""
    items = data if isinstance(data, list) else data.get("jobs") or data.get("results") or data.get("listings") or [data]
    jobs = []
    for item in items:
        if not isinstance(item, dict):
            continue
        title = item.get("title") or item.get("job_title") or item.get("name", "")
        if not title:
            continue
        jobs.append({
            "title": str(title),
            "url": item.get("url") or item.get("link") or source_url,
            "company": str(item.get("company") or item.get("employer", "")),
            "location": str(item.get("location", "")),
            "description": str(item.get("description", ""))[:500],
            "pay": str(item.get("salary") or item.get("pay") or item.get("salary_range", "")),
            "posted": str(item.get("posted") or item.get("posted_date") or item.get("closing_date", "")),
            "job_type": str(item.get("job_type") or item.get("type", "")),
            "department": str(item.get("department", "")),
        })
    return jobs


def _extract_jobs_from_markdown(markdown: str, source_url: str) -> list[dict]:
    """Best-effort extraction of job entries from scraped markdown."""
    jobs = []
    lines = markdown.split("\n")
    current: dict = {}

    for line in lines:
        stripped = line.strip()
        if not stripped:
            if current.get("title"):
                jobs.append(current)
                current = {}
            continue

        heading_match = re.match(r"^#{1,4}\s+(.+)", stripped)
        if heading_match and not current.get("title"):
            current["title"] = heading_match.group(1).strip()
            current["source_url"] = source_url
            continue

        bold_match = re.match(r"^\*\*(.+?)\*\*", stripped)
        if bold_match:
            text = bold_match.group(1).strip()
            if not current.get("title"):
                current["title"] = text
                current["source_url"] = source_url
            elif not current.get("company"):
                current["company"] = text
            continue

        link_match = re.match(r"^\[(.+?)\]\((.+?)\)", stripped)
        if link_match and not current.get("title"):
            current["title"] = link_match.group(1).strip()
            current["url"] = link_match.group(2).strip()
            current["source_url"] = source_url
            continue

        if current.get("title") and not current.get("location"):
            for pat in [r"(Montgomery|Alabama|AL|Remote)", r"(\d+\s+(?:days?|hours?)\s+ago)"]:
                m = re.search(pat, stripped, re.IGNORECASE)
                if m:
                    if "ago" in m.group(0).lower():
                        current["posted"] = m.group(0)
                    else:
                        current["location"] = stripped
                    break

        if current.get("title") and not current.get("description"):
            if len(stripped) > 40 and not stripped.startswith(("#", "*", "[", "|", "---")):
                current["description"] = stripped[:300]

    if current.get("title"):
        jobs.append(current)
    return jobs


def _deduplicate(jobs: list[dict]) -> list[dict]:
    seen = set()
    unique = []
    for job in jobs:
        key = (job.get("title", "").lower().strip(), job.get("company", "").lower().strip())
        if key not in seen:
            seen.add(key)
            unique.append(job)
    return unique


def _short_url(url: str) -> str:
    return url.split("//")[-1][:50]
