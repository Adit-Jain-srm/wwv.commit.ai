from __future__ import annotations

from pathlib import Path
from typing import Any, Tuple
from datetime import datetime, timedelta, timezone, date
import json

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data_collection" / "data"


def _load_json(filename: str, default: Any) -> Any:
    path = DATA_DIR / filename
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def get_jobs() -> list[dict]:
    data = _load_json("jobs_latest.json", default=[])
    return data if isinstance(data, list) else []


def get_trends() -> dict:
    data = _load_json("trends_latest.json", default={})
    return data if isinstance(data, dict) else {}


def get_business_signals() -> list[dict]:
    data = _load_json("business_latest.json", default=[])
    return data if isinstance(data, list) else []


def get_neighborhoods() -> list[dict]:
    """
    Mock neighborhood-level aggregation.

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
    data = _load_json("pipeline_summary.json", default={})
    return data if isinstance(data, dict) else {}


def get_pipeline_progress() -> dict:
    """
    Return live pipeline progress when a run is in flight.
    Written by data_collection.pipeline and by run-pipeline on start.
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
                "current_step": "Starting Bright Data pipeline…",
                "steps_done": [],
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }),
            encoding="utf-8",
        )
    except Exception:
        pass


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
    import re

    m = re.search(r"(\d+)\s+(day|days)\s+ago", lower)
    if m:
        days = int(m.group(1))
        return (datetime.now(timezone.utc) - timedelta(days=days)).date()

    m = re.search(r"(\d+)\s+(week|weeks)\s+ago", lower)
    if m:
        weeks = int(m.group(1))
        return (datetime.now(timezone.utc) - timedelta(weeks=weeks)).date()

    m = re.search(r"(\d+)\s+(month|months)\s+ago", lower)
    if m:
        months = int(m.group(1))
        return (datetime.now(timezone.utc) - timedelta(days=30 * int(m.group(1)))).date()

    return None


def _map_industry_to_series_key(industry: str | None) -> str | None:
    """
    Map Montgomery-aligned industry labels from data_collection.analysis
    to the series keys used by the frontend charts.
    """
    if not industry:
        return None
    industry = industry.lower()
    if industry == "government":
        return "government"
    if industry == "defense_federal":
        return "defense"
    if industry == "public_safety":
        return "public_safety"
    if industry == "healthcare":
        return "healthcare"
    if industry == "manufacturing":
        return "manufacturing"
    if industry == "technology":
        return "technology"
    if industry == "education":
        return "education"
    return None


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

    timeseries: list[dict[str, Any]] = []
    for day in sorted(buckets.keys()):
        entry: dict[str, Any] = {"date": day}
        entry.update(buckets[day])
        timeseries.append(entry)

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

