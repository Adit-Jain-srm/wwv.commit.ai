from __future__ import annotations

import logging
import random
import re
import time
from pathlib import Path
from typing import Any, Tuple
from datetime import datetime, timedelta, timezone, date
import json

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data_collection" / "data"

# Simple in-memory cache: {filename: (timestamp, data)}
_cache: dict[str, tuple[float, Any]] = {}
_CACHE_TTL = 30  # seconds


def _load_json(filename: str, default: Any) -> Any:
    path = DATA_DIR / filename
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        logger.warning("Failed to load %s: %s", filename, e)
        return default


def _cached_load(filename: str, default: Any) -> Any:
    """Load JSON with in-memory caching (30s TTL)."""
    cache_key = str(DATA_DIR / filename)
    now = time.monotonic()
    cached = _cache.get(cache_key)
    if cached is not None:
        ts, data = cached
        if now - ts < _CACHE_TTL:
            return data
    data = _load_json(filename, default)
    _cache[cache_key] = (now, data)
    return data


def get_jobs() -> list[dict]:
    data = _cached_load("jobs_latest.json", default=[])
    return data if isinstance(data, list) else []


def get_trends() -> dict:
    data = _cached_load("trends_latest.json", default={})
    return data if isinstance(data, dict) else {}


def get_business_signals() -> list[dict]:
    data = _cached_load("business_latest.json", default=[])
    return data if isinstance(data, list) else []


def _transform_glassdoor(raw: list) -> list:
    """Parse SERP-style Glassdoor results into structured employer records."""
    result = []
    for entry in raw:
        title = entry.get("title", "")
        desc = entry.get("description", "")
        # Extract company name: everything before " Reviews" or " Salaries" etc.
        name_match = re.match(r'^(.+?)(?:\s+Reviews|\s+Salaries|\s+Interview|\s+Jobs)', title)
        company_name = name_match.group(1).strip() if name_match else title.split(" - ")[0].strip()
        if not company_name:
            company_name = title.strip() or "Unknown"
        # Extract rating from description: "X.X out of 5" or "rated X.X" or "X.X stars"
        rating_match = re.search(r'(\d+\.?\d*)\s*(?:out of 5|/5|stars?)', desc, re.I)
        overall_rating = float(rating_match.group(1)) if rating_match else None
        # Extract review count from title parenthetical "(N)"
        count_match = re.search(r'\((\d[\d,]*)\)', title)
        reviews_count = int(count_match.group(1).replace(",", "")) if count_match else None
        result.append({
            "company_name": company_name,
            "overall_rating": overall_rating,
            "reviews_count": reviews_count,
            "url": entry.get("url", ""),
        })
    return result


def _transform_google_maps(raw: list) -> list:
    """Parse SERP-style Google Maps results into structured business records."""
    result = []
    for entry in raw:
        title = entry.get("title", "")
        desc = entry.get("description", "")
        query = entry.get("query", "")
        name = title.split(" - ")[0].strip() if " - " in title else title.strip()
        if not name:
            name = "Local Business"
        # Try to extract rating
        rating_match = re.search(r'(\d+\.?\d*)\s*(?:stars?|/5|rating)', desc, re.I)
        rating = float(rating_match.group(1)) if rating_match else None
        # Category from query keywords
        category = query.replace("Montgomery AL ", "").replace("montgomery ", "").strip().title() if query else "Business"
        result.append({
            "name": name,
            "category": category,
            "rating": rating,
            "reviews_count": None,
            "address": "Montgomery, AL",
            "url": entry.get("url", ""),
        })
    return result


def get_glassdoor_data() -> list:
    data = _cached_load("glassdoor_latest.json", default=[])
    raw = data if isinstance(data, list) else []
    return _transform_glassdoor(raw)


def get_google_maps_data() -> list:
    data = _cached_load("google_maps_latest.json", default=[])
    raw = data if isinstance(data, list) else []
    return _transform_google_maps(raw)


def get_neighborhoods() -> list[dict]:
    """
    Neighborhood-level aggregation derived from sector counts.

    In a real deployment, this would join jobs/business data with GIS
    neighborhoods from the Montgomery Open Data Portal. For hackathon scope,
    we return a small static set derived from sector counts.
    """
    jobs = get_jobs()
    by_sector: dict[str, int] = {}
    for j in jobs:
        sec = j.get("sector", "private")
        by_sector[sec] = by_sector.get(sec, 0) + 1

    total = max(len(jobs), 1)

    return [
        {
            "name": "Downtown Montgomery",
            "job_density_score": round(by_sector.get("public", 0) / total * 100, 1),
            "top_sector": "public" if by_sector.get("public", 0) >= by_sector.get("private", 0) else "private",
        },
        {
            "name": "Maxwell / Gunter Area",
            "job_density_score": round(by_sector.get("federal", 0) / total * 100, 1),
            "top_sector": "federal" if by_sector.get("federal", 0) else "private",
        },
        {
            "name": "East Montgomery",
            "job_density_score": round(by_sector.get("private", 0) / total * 100, 1),
            "top_sector": "private",
        },
    ]


def get_pipeline_summary() -> dict:
    """
    Return the latest pipeline summary, if any.

    Schema is defined in data_collection.pipeline; we only
    surface a small, read-only subset to the frontend.
    """
    data = _cached_load("pipeline_summary.json", default={})
    return data if isinstance(data, dict) else {}


def get_pipeline_progress() -> dict:
    """
    Return live pipeline progress when a run is in flight.
    Written by data_collection.pipeline and by run-pipeline on start.
    Uses _load_json directly (no cache) for real-time progress.
    """
    data = _load_json("pipeline_progress.json", default={})
    return data if isinstance(data, dict) else {}


def write_pipeline_progress_start() -> None:
    """Write initial 'running' state when run-pipeline is triggered."""
    path = DATA_DIR / "pipeline_progress.json"
    try:
        path.write_text(
            json.dumps({
                "running": True,
                "progress": 0,
                "current_step": "Starting Bright Data pipeline\u2026",
                "steps_done": [],
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }),
            encoding="utf-8",
        )
        # Invalidate cache so next read picks up new state
        _cache.pop(str(DATA_DIR / "pipeline_progress.json"), None)
    except Exception as e:
        logger.warning("Failed to write pipeline progress start: %s", e)


# Compiled regex patterns for date parsing
_RE_DAYS_AGO = re.compile(r"(\d+)\s+(day|days)\s+ago")
_RE_WEEKS_AGO = re.compile(r"(\d+)\s+(week|weeks)\s+ago")
_RE_MONTHS_AGO = re.compile(r"(\d+)\s+(month|months)\s+ago")


def _parse_posted_date(text: str) -> date | None:
    """
    Best-effort parse of job 'posted' or 'collected_at' into a date.
    Supports absolute dates (YYYY-MM-DD) and relative phrases like
    '3 days ago', '2 weeks ago', '1 month ago'.
    """
    if not text:
        return None
    text = str(text).strip()
    # ISO-like date
    try:
        if len(text) >= 10 and text[4] == "-" and text[7] == "-":
            return datetime.fromisoformat(text[:10]).date()
    except Exception:
        pass

    lower = text.lower()

    m = _RE_DAYS_AGO.search(lower)
    if m:
        days = int(m.group(1))
        return (datetime.now(timezone.utc) - timedelta(days=days)).date()

    m = _RE_WEEKS_AGO.search(lower)
    if m:
        weeks = int(m.group(1))
        return (datetime.now(timezone.utc) - timedelta(weeks=weeks)).date()

    m = _RE_MONTHS_AGO.search(lower)
    if m:
        months = int(m.group(1))
        return (datetime.now(timezone.utc) - timedelta(days=30 * months)).date()

    return None


def _map_industry_to_series_key(industry: str | None) -> str | None:
    """
    Map Montgomery-aligned industry labels from data_collection.analysis
    to the series keys used by the frontend charts.
    """
    if not industry:
        return None
    industry = industry.lower()
    _MAPPING: dict[str, str] = {
        "government": "government",
        "defense_federal": "defense",
        "public_safety": "public_safety",
        "healthcare": "healthcare",
        "manufacturing": "manufacturing",
        "technology": "technology",
        "education": "education",
        # Map remaining industry types to nearest chart series
        "construction_trades": "manufacturing",
        "retail_hospitality": "government",  # civic-adjacent services
        "transportation": "manufacturing",
    }
    return _MAPPING.get(industry)


def _synthesize_historical_timeseries(
    jobs: list, base_date_str: str, series_keys: list
) -> list:
    """Generate 12-week synthetic history when only one data point exists."""
    rng = random.Random(42)  # deterministic seed
    # Count jobs per mapped industry
    industry_totals: dict[str, int] = {k: 0 for k in series_keys}
    unmapped_count = 0
    for job in jobs:
        key = _map_industry_to_series_key(job.get("industry"))
        if key and key in industry_totals:
            industry_totals[key] += 1
        else:
            unmapped_count += 1

    # Distribute unmapped/null-industry jobs proportionally across sectors
    mapped_total = sum(industry_totals.values())
    if unmapped_count > 0 and mapped_total > 0:
        for k in series_keys:
            if k == "other":
                continue
            share = industry_totals[k] / mapped_total
            industry_totals[k] += round(unmapped_count * share)
    elif unmapped_count > 0:
        # All jobs are unmapped — distribute evenly across non-"other" keys
        valid_keys = [k for k in series_keys if k != "other"]
        per_key = max(1, unmapped_count // len(valid_keys))
        for k in valid_keys:
            industry_totals[k] = per_key

    try:
        base = datetime.fromisoformat(base_date_str.split("T")[0])
    except (ValueError, AttributeError):
        base = datetime.now()

    weeks = 12
    points = []
    # Use a mild wave pattern instead of monotonic growth
    # This creates realistic variation without artificial trend bias
    import math
    for w in range(weeks):
        d = (base - timedelta(weeks=weeks - 1 - w)).isoformat()[:10]
        progress = w / (weeks - 1) if weeks > 1 else 1.0
        # Oscillate around 0.95-1.05 with a slight upward drift
        wave = 0.92 + 0.08 * progress + 0.06 * math.sin(progress * math.pi * 2.5)
        entry: dict = {"date": d}
        for k in series_keys:
            total = industry_totals.get(k, 0)
            noisy = total * wave * (0.88 + rng.random() * 0.24)
            entry[k] = max(0, round(noisy))
        points.append(entry)
    return points


def get_jobs_with_summary() -> Tuple[list[dict], dict, list[dict]]:
    """
    Return jobs plus a computed dashboard summary and simple timeseries.

    - jobs: enriched job records from jobs_latest.json
    - summary: total postings, sector ratios, headline industry, new business count
    - timeseries: per-day counts by industry based on job 'posted' dates
    """
    jobs = get_jobs()
    trends = get_trends()
    signals = get_business_signals()

    total_jobs = len(jobs)
    public_ratio = float(trends.get("public_sector_ratio", 0.0))
    private_ratio = max(0.0, 1.0 - public_ratio)

    by_industry = trends.get("by_industry", {}) or {}
    top_growing_industry = next(iter(by_industry.keys()), "N/A")

    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)
    new_business_count = 0
    for s in signals:
        if s.get("signal_type") != "new_business":
            continue
        ts = s.get("collected_at")
        try:
            if ts:
                dt = datetime.fromisoformat(str(ts))
                if dt >= thirty_days_ago:
                    new_business_count += 1
        except Exception:
            continue

    summary = {
        "total_active_postings": total_jobs,
        "public_ratio": round(public_ratio, 3),
        "private_ratio": round(private_ratio, 3),
        "top_growing_industry": top_growing_industry,
        "new_businesses_this_month": new_business_count,
        "last_updated": now.isoformat(),
    }

    # Build simple per-day timeseries for the last 365 days.
    cutoff = now.date() - timedelta(days=365)
    series_keys = [
        "government",
        "defense",
        "healthcare",
        "manufacturing",
        "technology",
        "education",
        "public_safety",
        "other",
    ]
    buckets: dict[str, dict[str, int]] = {}

    for job in jobs:
        posted_raw = job.get("posted") or job.get("collected_at", "")
        d = _parse_posted_date(str(posted_raw))
        if not d or d < cutoff:
            continue
        key = _map_industry_to_series_key(job.get("industry"))
        if not key:
            key = "other"
        day = d.isoformat()
        if day not in buckets:
            buckets[day] = {k: 0 for k in series_keys}
        buckets[day][key] += 1

    timeseries = [{"date": d, **buckets[d]} for d in sorted(buckets)]

    # Compute job growth % (first vs last in last 30 days)
    job_growth_pct: float | None = None
    if timeseries:
        cutoff_30d = now.date() - timedelta(days=30)
        recent = [e for e in timeseries if datetime.fromisoformat(e["date"]).date() >= cutoff_30d]
        if len(recent) >= 2:
            totals = [
                sum(e.get(k, 0) for k in series_keys)
                for e in recent
            ]
            first_val, last_val = totals[0], totals[-1]
            if first_val > 0:
                job_growth_pct = round(((last_val - first_val) / first_val) * 100, 1)
    summary["job_growth_pct_30d"] = job_growth_pct

    return jobs, summary, timeseries
