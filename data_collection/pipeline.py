"""
Workforce Pulse — Data Collection Pipeline

Montgomery's Strategic Workforce Intelligence Platform.

Usage:
    python -m data_collection.pipeline              # run all collectors
    python -m data_collection.pipeline --jobs       # jobs only
    python -m data_collection.pipeline --business   # business signals only
"""

import argparse
import asyncio
import json
import logging
from datetime import datetime, timezone

from .brightdata_client import BrightDataClient
from .collectors.business import collect_business_signals
from .collectors.jobs import collect_jobs
from .config import DATA_DIR

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("pipeline")


async def run_pipeline(run_jobs: bool = True, run_business: bool = True):
    logger.info("=" * 64)
    logger.info("  Workforce Pulse — Montgomery Strategic Intelligence")
    logger.info("  Output: %s", DATA_DIR)
    logger.info("=" * 64)

    summary: dict = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "region": "Montgomery, AL",
        "results": {},
    }

    async with BrightDataClient() as client:
        if run_jobs:
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

        if run_business:
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
    args = parser.parse_args()

    run_jobs = True
    run_business = True
    if args.jobs or args.business:
        run_jobs = args.jobs
        run_business = args.business

    asyncio.run(run_pipeline(run_jobs, run_business))


if __name__ == "__main__":
    main()
