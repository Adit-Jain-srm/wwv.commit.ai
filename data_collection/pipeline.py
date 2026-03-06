"""
Workforce Pulse — Data Collection Pipeline

Montgomery's Strategic Workforce Intelligence Platform.

Usage:
    python -m data_collection.pipeline              # run all collectors
    python -m data_collection.pipeline --jobs       # jobs only
    python -m data_collection.pipeline --business   # business signals only
    python -m data_collection.pipeline --glassdoor  # glassdoor only
    python -m data_collection.pipeline --google-maps # google maps only
"""

import argparse
import asyncio
import json
import logging
from datetime import datetime, timezone

from .brightdata_client import BrightDataClient
from .collectors.business import collect_business_signals
from .collectors.glassdoor import collect_glassdoor
from .collectors.google_maps import collect_google_maps
from .collectors.jobs import collect_jobs
from .config import DATA_DIR

PROGRESS_FILE = DATA_DIR / "pipeline_progress.json"


def _write_progress(
    progress: int,
    current_step: str,
    steps_done: list[str] | None = None,
    stages: list[dict] | None = None,
) -> None:
    """Write progress to a JSON file for frontend polling."""
    try:
        data = {
            "running": progress < 100,
            "progress": progress,
            "current_step": current_step,
            "steps_done": steps_done or [],
            "stages": stages or [],
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        PROGRESS_FILE.write_text(json.dumps(data), encoding="utf-8")
    except Exception as e:
        logger.warning("Could not write progress file: %s", e)


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("pipeline")


async def run_pipeline(
    run_jobs: bool = True,
    run_business: bool = True,
    run_glassdoor: bool = True,
    run_google_maps: bool = True,
):
    logger.info("=" * 64)
    logger.info("  Workforce Pulse — Montgomery Strategic Intelligence")
    logger.info("  Output: %s", DATA_DIR)
    logger.info("=" * 64)

    summary: dict = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "region": "Montgomery, AL",
        "results": {},
    }

    steps_done: list[str] = []
    stages: list[dict] = []
    total_steps = (
        (2 if run_jobs else 0)
        + (2 if run_business else 0)
        + (1 if run_glassdoor else 0)
        + (1 if run_google_maps else 0)
    )
    if total_steps == 0:
        total_steps = 1
    step = 0

    _write_progress(0, "Initializing Bright Data…", steps_done, stages)

    async with BrightDataClient() as client:
        if run_jobs:
            _write_progress(
                int(100 * step / total_steps),
                "LinkedIn job listings + SERP + AI extract (Indeed, USAJobs, JobAps)",
                steps_done,
                stages,
            )
            logger.info("\n▸ Collecting job postings...")
            jobs = await collect_jobs(client)

            trends_path = DATA_DIR / "trends_latest.json"
            trends = {}
            if trends_path.exists():
                trends = json.loads(trends_path.read_text(encoding="utf-8"))

            summary["results"]["jobs"] = {
                "count": len(jobs),
                "by_sector": trends.get("by_sector", {}),
                "public_sector_ratio": trends.get("public_sector_ratio", 0),
                "top_industries": list(trends.get("by_industry", {}).keys())[:5],
                "top_skills": trends.get("in_demand_skills", [])[:10],
                "skills_gaps": [
                    g["skill"] for g in trends.get("skills_gap", []) if g.get("gap")
                ][:10],
                "sample": jobs[:3] if jobs else [],
            }
            logger.info("▸ Jobs: %d entries | Sector: %s", len(jobs), summary["results"]["jobs"]["by_sector"])
            step += 1
            steps_done.append("Job collection (LinkedIn, SERP, AI extract)")
            stages.append({"name": "jobs", "status": "done", "items": len(jobs)})

        if run_business:
            _write_progress(
                int(100 * step / total_steps),
                "LinkedIn companies + SERP + AI extract (open data)",
                steps_done,
                stages,
            )
            logger.info("\n▸ Collecting business growth signals...")
            signals = await collect_business_signals(client)

            signal_types = {}
            for s in signals:
                st = s.get("signal_type", "general")
                signal_types[st] = signal_types.get(st, 0) + 1

            summary["results"]["business_signals"] = {
                "count": len(signals),
                "by_signal_type": signal_types,
                "sample": signals[:3] if signals else [],
            }
            logger.info("▸ Business signals: %d entries | Types: %s", len(signals), signal_types)
            step += 1
            steps_done.append("Business signals (LinkedIn, SERP, AI extract)")
            stages.append({"name": "business_signals", "status": "done", "items": len(signals)})

        # ── Glassdoor employer quality (non-fatal) ─────────────────
        if run_glassdoor:
            _write_progress(
                int(100 * step / total_steps),
                "Glassdoor employer quality signals",
                steps_done,
                stages,
            )
            try:
                logger.info("\n▸ Collecting Glassdoor employer signals...")
                glassdoor = await collect_glassdoor(client)
                summary["results"]["glassdoor"] = {
                    "count": len(glassdoor),
                    "sample": glassdoor[:3] if glassdoor else [],
                }
                logger.info("▸ Glassdoor: %d entries", len(glassdoor))
                steps_done.append("Glassdoor employer quality")
                stages.append({"name": "glassdoor", "status": "done", "items": len(glassdoor)})
            except Exception as e:
                logger.warning("Glassdoor collection failed (non-fatal): %s", e)
                steps_done.append("Glassdoor (skipped)")
                stages.append({"name": "glassdoor", "status": "skipped", "items": 0})
            step += 1

        # ── Google Maps local business (non-fatal) ─────────────────
        if run_google_maps:
            _write_progress(
                int(100 * step / total_steps),
                "Google Maps local business discovery",
                steps_done,
                stages,
            )
            try:
                logger.info("\n▸ Collecting Google Maps business signals...")
                maps = await collect_google_maps(client)
                summary["results"]["google_maps"] = {
                    "count": len(maps),
                    "sample": maps[:3] if maps else [],
                }
                logger.info("▸ Google Maps: %d entries", len(maps))
                steps_done.append("Google Maps business discovery")
                stages.append({"name": "google_maps", "status": "done", "items": len(maps)})
            except Exception as e:
                logger.warning("Google Maps collection failed (non-fatal): %s", e)
                steps_done.append("Google Maps (skipped)")
                stages.append({"name": "google_maps", "status": "skipped", "items": 0})
            step += 1

    _write_progress(100, "Complete", steps_done, stages)
    summary_path = DATA_DIR / "pipeline_summary.json"
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    logger.info("\n" + "=" * 64)
    logger.info("  Pipeline complete — Montgomery Workforce Intelligence")
    logger.info("-" * 64)
    for key, val in summary["results"].items():
        logger.info("  %-25s %d entries", key, val["count"])
    if "jobs" in summary["results"]:
        jr = summary["results"]["jobs"]
        logger.info("  Public sector ratio:     %.1f%%", jr.get("public_sector_ratio", 0) * 100)
        logger.info("  Top industries:          %s", jr.get("top_industries", []))
        gaps = jr.get("skills_gaps", [])
        if gaps:
            logger.info("  Skills gaps detected:    %s", gaps[:5])
    logger.info("=" * 64)

    return summary


def main():
    parser = argparse.ArgumentParser(description="Workforce Pulse data collection pipeline")
    parser.add_argument("--jobs", action="store_true", help="Collect job postings only")
    parser.add_argument("--business", action="store_true", help="Collect business signals only")
    parser.add_argument("--glassdoor", action="store_true", help="Collect Glassdoor employer signals only")
    parser.add_argument("--google-maps", action="store_true", help="Collect Google Maps business signals only")
    args = parser.parse_args()

    run_jobs = True
    run_business = True
    run_gd = True
    run_gm = True
    if args.jobs or args.business or args.glassdoor or args.google_maps:
        run_jobs = args.jobs
        run_business = args.business
        run_gd = args.glassdoor
        run_gm = args.google_maps

    asyncio.run(run_pipeline(run_jobs, run_business, run_gd, run_gm))


if __name__ == "__main__":
    main()
