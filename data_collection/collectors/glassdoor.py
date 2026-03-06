"""
Glassdoor employer quality signals collector.

Data sources:
  1. Glassdoor structured API (via Bright Data SDK)
  2. SERP search for employer reviews / ratings
"""

import json
import logging
from datetime import datetime, timezone

from ..brightdata_client import BrightDataClient
from ..config import (
    DATA_DIR,
    GEO_LOCATION,
    GLASSDOOR_EMPLOYER_URLS,
    GLASSDOOR_SEARCH_QUERIES,
)

logger = logging.getLogger(__name__)


async def collect_glassdoor(client: BrightDataClient) -> list[dict]:
    """
    Collect Glassdoor employer quality signals:
      Phase 1 — Structured Glassdoor data (SDK dataset)
      Phase 2 — SERP search for employer reviews
    """
    all_signals: list[dict] = []
    timestamp = datetime.now(timezone.utc).isoformat()

    # ── Phase 1: Glassdoor structured data ─────────────────────────
    logger.info("Glassdoor Phase 1: Structured employer data...")
    for url in GLASSDOOR_EMPLOYER_URLS:
        try:
            data = await client.glassdoor_jobs(url)
            signals = _parse_glassdoor(data, url, timestamp)
            logger.info("  %s -> %d signals", _short_url(url), len(signals))
            all_signals.extend(signals)
        except Exception as e:
            logger.warning("  Glassdoor failed for %s: %s", _short_url(url), e)

    # ── Phase 2: SERP search for reviews ───────────────────────────
    logger.info("Glassdoor Phase 2: SERP search for employer reviews...")
    search_results = await client.search_batch(
        GLASSDOOR_SEARCH_QUERIES, country=GEO_LOCATION
    )
    for query, results in search_results.items():
        for r in results:
            all_signals.append({
                "title": r.get("title", ""),
                "url": r.get("url") or r.get("link", ""),
                "description": r.get("description", ""),
                "source": "glassdoor_serp",
                "signal_type": _classify_glassdoor_signal(
                    r.get("title", "") + " " + r.get("description", "")
                ),
                "query": query,
                "collected_at": timestamp,
            })
    logger.info(
        "  SERP yielded %d entries",
        sum(len(v) for v in search_results.values()),
    )

    # ── Save ───────────────────────────────────────────────────────
    all_signals = _deduplicate(all_signals)
    logger.info("Total unique Glassdoor signals: %d", len(all_signals))

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    (DATA_DIR / f"glassdoor_{ts}.json").write_text(
        json.dumps(all_signals, indent=2), encoding="utf-8"
    )
    (DATA_DIR / "glassdoor_latest.json").write_text(
        json.dumps(all_signals, indent=2), encoding="utf-8"
    )
    logger.info("Saved Glassdoor signals to data/")

    return all_signals


# ── Parsing helpers ──────────────────────────────────────────────


def _parse_glassdoor(data, source_url: str, timestamp: str) -> list[dict]:
    """Parse Glassdoor SDK response into normalized signals."""
    signals = []
    items = data if isinstance(data, list) else [data] if isinstance(data, dict) else []

    for item in items:
        if not isinstance(item, dict):
            continue
        name = (
            item.get("employer_name")
            or item.get("company")
            or item.get("name")
            or item.get("title", "")
        )
        if not name:
            continue

        signal: dict = {
            "title": str(name),
            "url": item.get("url") or item.get("employer_url") or source_url,
            "source": "glassdoor",
            "signal_type": "employer_quality",
            "collected_at": timestamp,
        }

        # Rating fields
        for field in (
            "overall_rating", "rating", "culture_rating",
            "work_life_balance_rating", "compensation_rating",
            "career_opportunities_rating", "senior_management_rating",
        ):
            val = item.get(field)
            if val is not None:
                signal[field] = val

        # If there's just a top-level "rating", map to overall_rating
        if "overall_rating" not in signal and item.get("rating"):
            signal["overall_rating"] = item["rating"]

        review_count = item.get("review_count") or item.get("number_of_reviews")
        if review_count is not None:
            signal["review_count"] = review_count

        description = item.get("description") or item.get("pros", "")
        if description:
            signal["description"] = str(description)[:500]

        for field in ("pros", "cons", "industry", "headquarters", "size", "revenue"):
            val = item.get(field)
            if val:
                signal[field] = val

        signals.append(signal)

    return signals


def _classify_glassdoor_signal(text: str) -> str:
    """Classify Glassdoor SERP result type."""
    text_lower = text.lower()
    if any(kw in text_lower for kw in ["salary", "compensation", "pay"]):
        return "salary_data"
    if any(kw in text_lower for kw in ["review", "rating", "culture", "work-life"]):
        return "employer_review"
    if any(kw in text_lower for kw in ["interview", "hiring process"]):
        return "interview_data"
    if any(kw in text_lower for kw in ["benefit", "insurance", "401k", "pto"]):
        return "benefits_data"
    return "employer_quality"


def _deduplicate(signals: list[dict]) -> list[dict]:
    seen = set()
    unique = []
    for s in signals:
        key = (s.get("title", "").lower().strip(), s.get("source", ""))
        if key not in seen:
            seen.add(key)
            unique.append(s)
    return unique


def _short_url(url: str) -> str:
    return url.split("//")[-1][:50]
