"""
Google Maps business discovery collector.

Data sources:
  1. Google Maps structured reviews (via Bright Data SDK)
  2. SERP search for local business discovery
"""

import json
import logging
from datetime import datetime, timezone

from ..brightdata_client import BrightDataClient
from ..config import (
    DATA_DIR,
    GEO_LOCATION,
    GOOGLE_MAPS_URLS,
    GOOGLE_MAPS_SEARCH_QUERIES,
)

logger = logging.getLogger(__name__)


async def collect_google_maps(client: BrightDataClient) -> list[dict]:
    """
    Collect Google Maps local business signals:
      Phase 1 — Structured Google Maps reviews (SDK dataset)
      Phase 2 — SERP search for local business discovery
    """
    all_signals: list[dict] = []
    timestamp = datetime.now(timezone.utc).isoformat()

    # ── Phase 1: Google Maps structured data ───────────────────────
    logger.info("Google Maps Phase 1: Structured business/review data...")
    for url in GOOGLE_MAPS_URLS:
        try:
            data = await client.google_maps_reviews(url)
            signals = _parse_google_maps(data, url, timestamp)
            logger.info("  %s -> %d signals", _short_url(url), len(signals))
            all_signals.extend(signals)
        except Exception as e:
            logger.warning("  Google Maps failed for %s: %s", _short_url(url), e)

    # ── Phase 2: SERP search for local businesses ──────────────────
    logger.info("Google Maps Phase 2: SERP search for local businesses...")
    search_results = await client.search_batch(
        GOOGLE_MAPS_SEARCH_QUERIES, country=GEO_LOCATION
    )
    for query, results in search_results.items():
        for r in results:
            all_signals.append({
                "title": r.get("title", ""),
                "url": r.get("url") or r.get("link", ""),
                "description": r.get("description", ""),
                "source": "google_maps_serp",
                "signal_type": "local_business_discovery",
                "query": query,
                "collected_at": timestamp,
            })
    logger.info(
        "  SERP yielded %d entries",
        sum(len(v) for v in search_results.values()),
    )

    # ── Save ───────────────────────────────────────────────────────
    all_signals = _deduplicate(all_signals)
    logger.info("Total unique Google Maps signals: %d", len(all_signals))

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    (DATA_DIR / f"google_maps_{ts}.json").write_text(
        json.dumps(all_signals, indent=2), encoding="utf-8"
    )
    (DATA_DIR / "google_maps_latest.json").write_text(
        json.dumps(all_signals, indent=2), encoding="utf-8"
    )
    logger.info("Saved Google Maps signals to data/")

    return all_signals


# ── Parsing helpers ──────────────────────────────────────────────


def _parse_google_maps(data, source_url: str, timestamp: str) -> list[dict]:
    """Parse Google Maps SDK response into normalized signals."""
    signals = []
    items = data if isinstance(data, list) else [data] if isinstance(data, dict) else []

    for item in items:
        if not isinstance(item, dict):
            continue
        name = (
            item.get("name")
            or item.get("title")
            or item.get("place_name", "")
        )
        if not name:
            continue

        signal: dict = {
            "title": str(name),
            "url": item.get("url") or item.get("place_url") or source_url,
            "source": "google_maps",
            "signal_type": "local_business",
            "collected_at": timestamp,
        }

        address = item.get("address") or item.get("full_address", "")
        if address:
            signal["address"] = str(address)

        category = item.get("category") or item.get("type") or item.get("categories")
        if category:
            signal["category"] = (
                ", ".join(category) if isinstance(category, list) else str(category)
            )

        rating = item.get("rating") or item.get("overall_rating")
        if rating is not None:
            signal["rating"] = rating

        review_count = item.get("review_count") or item.get("reviews_count") or item.get("total_reviews")
        if review_count is not None:
            signal["review_count"] = review_count

        phone = item.get("phone") or item.get("phone_number")
        if phone:
            signal["phone"] = str(phone)

        # Review text (if single-review response)
        review_text = item.get("review_text") or item.get("text")
        if review_text:
            signal["review_text"] = str(review_text)[:500]

        review_rating = item.get("review_rating") or item.get("stars")
        if review_rating is not None:
            signal["review_rating"] = review_rating

        signals.append(signal)

    return signals


def _deduplicate(signals: list[dict]) -> list[dict]:
    seen = set()
    unique = []
    for s in signals:
        key = (
            s.get("title", "").lower().strip(),
            s.get("address", "").lower().strip() if s.get("address") else s.get("source", ""),
        )
        if key not in seen:
            seen.add(key)
            unique.append(s)
    return unique


def _short_url(url: str) -> str:
    return url.split("//")[-1][:50]
