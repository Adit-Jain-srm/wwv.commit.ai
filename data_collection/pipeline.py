"""
Workforce Pulse — Data Collection Pipeline

Usage:
    python -m data_collection.pipeline              # run all collectors
    python -m data_collection.pipeline --jobs       # jobs only
    python -m data_collection.pipeline --business   # business signals only
"""

import argparse
import asyncio
import json
import logging
import sys
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
    logger.info("=" * 60)
    logger.info("Workforce Pulse — Data Collection Pipeline")
    logger.info("Output directory: %s", DATA_DIR)
    logger.info("=" * 60)

    summary: dict = {"timestamp": datetime.now(timezone.utc).isoformat(), "results": {}}

    async with BrightDataClient() as client:
        if run_jobs:
            logger.info("\n▸ Starting job postings collection...")
            jobs = await collect_jobs(client)
            summary["results"]["jobs"] = {
                "count": len(jobs),
                "sample": jobs[:3] if jobs else [],
            }
            logger.info("▸ Jobs complete: %d entries\n", len(jobs))

        if run_business:
            logger.info("\n▸ Starting business signals collection...")
            signals = await collect_business_signals(client)
            summary["results"]["business_signals"] = {
                "count": len(signals),
                "sample": signals[:3] if signals else [],
            }
            logger.info("▸ Business signals complete: %d entries\n", len(signals))

    summary_path = DATA_DIR / "pipeline_summary.json"
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    logger.info("=" * 60)
    logger.info("Pipeline finished.")
    for key, val in summary["results"].items():
        logger.info("  %-25s %d entries", key, val["count"])
    logger.info("Summary saved to %s", summary_path)
    logger.info("=" * 60)

    return summary


def main():
    parser = argparse.ArgumentParser(
        description="Workforce Pulse data collection pipeline"
    )
    parser.add_argument(
        "--jobs", action="store_true", help="Collect job postings only"
    )
    parser.add_argument(
        "--business", action="store_true", help="Collect business signals only"
    )
    args = parser.parse_args()

    run_jobs = True
    run_business = True
    if args.jobs or args.business:
        run_jobs = args.jobs
        run_business = args.business

    asyncio.run(run_pipeline(run_jobs, run_business))


if __name__ == "__main__":
    main()
