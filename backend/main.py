from __future__ import annotations

from pathlib import Path
import subprocess
from typing import Any, Dict, List

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware

from . import data_access
from .azure_ai import generate_insights, generate_policy_brief, ask_workforce_pulse, run_scenario


app = FastAPI(
    title="Workforce Pulse API",
    description="Backend for the Workforce, Business & Economic Growth dashboard (Montgomery).",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> Dict[str, Any]:
    return {"status": "ok"}


@app.get("/api/jobs")
async def list_jobs() -> Dict[str, Any]:
    """
    Return raw jobs plus a pre-computed dashboard summary and timeseries.

    - jobs: enriched job records from data_collection
    - summary: sector ratios, top industry, new business count, last_updated
    - timeseries: per-day counts by industry (government, defense, etc.)
    """
    jobs, summary, timeseries = data_access.get_jobs_with_summary()
    return {
        "jobs": jobs,
        "summary": summary,
        "timeseries": timeseries,
    }


@app.get("/api/industries")
async def industries() -> Dict[str, Any]:
    trends = data_access.get_trends()
    by_industry = trends.get("by_industry", {})
    top_industries = trends.get("top_industries", [])
    return {
        "by_industry": by_industry,
        "top_industries": top_industries,
    }


@app.get("/api/skills")
async def skills() -> Dict[str, Any]:
    trends = data_access.get_trends()
    in_demand = trends.get("in_demand_skills", {})
    skills_gap = trends.get("skills_gap", {})
    # Normalise to both dict (for legacy tests) and list (for frontend).
    if isinstance(in_demand, list):
        in_demand_dict = {name: idx for idx, name in enumerate(in_demand)}
        in_demand_list = in_demand
    else:
        in_demand_dict = in_demand
        in_demand_list = list(in_demand.keys())

    if isinstance(skills_gap, list):
        skills_gap_dict = {g.get("skill", f"skill_{i}"): g for i, g in enumerate(skills_gap)}
        skills_gap_list = skills_gap
    else:
        skills_gap_dict = skills_gap
        skills_gap_list = list(skills_gap.values())

    return {
        "in_demand_skills": in_demand_dict,
        "skills_gap": skills_gap_dict,
        "in_demand_skills_list": in_demand_list,
        "skills_gap_list": skills_gap_list,
    }


@app.get("/api/economic-signals")
async def economic_signals() -> Dict[str, List[Dict[str, Any]]]:
    signals = data_access.get_business_signals()
    return {"signals": signals}


@app.get("/api/neighborhoods")
async def neighborhoods() -> Dict[str, List[Dict[str, Any]]]:
    items = data_access.get_neighborhoods()
    return {"neighborhoods": items}


@app.get("/api/insights")
async def insights() -> Dict[str, Any]:
    jobs = data_access.get_jobs()
    trends = data_access.get_trends()
    signals = data_access.get_business_signals()

    if not jobs and not trends and not signals:
        # When there is no pipeline output, we explicitly return 503
        # so the frontend can prompt the user to run a fresh collection.
        raise HTTPException(
            status_code=503,
            detail="No data available. Run the data collection pipeline first.",
        )

    ai_insights = await generate_insights(jobs, trends, signals)
    return ai_insights


@app.get("/api/policy-brief")
async def policy_brief() -> Dict[str, Any]:
    """
    Generate a structured executive policy brief for city planners.
    Returns executive_summary, key_findings, recommended_actions — distinct from raw insights.
    """
    jobs = data_access.get_jobs()
    trends = data_access.get_trends()
    signals = data_access.get_business_signals()

    if not jobs and not trends and not signals:
        raise HTTPException(
            status_code=503,
            detail="No data available. Run the data collection pipeline first.",
        )

    insights_res = await generate_insights(jobs, trends, signals)
    raw_insights = insights_res.get("insights", [])

    return await generate_policy_brief(jobs, trends, signals, raw_insights)


@app.get("/api/pipeline-status")
async def pipeline_status() -> Dict[str, Any]:
    """
    Surface the latest data_collection pipeline summary for the frontend.
    """
    summary = data_access.get_pipeline_summary()
    results = summary.get("results", {})
    jobs_info = results.get("jobs", {})
    business_info = results.get("business_signals", {})
    return {
        "last_run": summary.get("timestamp"),
        "region": summary.get("region"),
        "jobs_count": jobs_info.get("count", 0),
        "business_signals_count": business_info.get("count", 0),
    }


@app.post("/api/ask")
async def ask(body: Dict[str, Any]) -> Dict[str, Any]:
    """
    Ask Workforce Pulse a natural-language question about Montgomery workforce and economic data.
    Request body: { "question": "What industries are growing fastest?" }
    """
    question = (body or {}).get("question", "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="question is required")

    jobs = data_access.get_jobs()
    trends = data_access.get_trends()
    signals = data_access.get_business_signals()

    result = await ask_workforce_pulse(question, jobs, trends, signals)
    return result


@app.post("/api/scenario")
async def scenario(body: Dict[str, Any]) -> Dict[str, Any]:
    """
    Run a scenario simulation (e.g. new data center) and get projected impact.
    Request body: { "scenario": "What happens if a new data center opens?" }
    """
    scenario_text = (body or {}).get("scenario", "").strip()
    if not scenario_text:
        scenario_text = "a new data center opens in Montgomery"

    jobs = data_access.get_jobs()
    trends = data_access.get_trends()
    signals = data_access.get_business_signals()

    result = await run_scenario(scenario_text, jobs, trends, signals)
    return result


@app.get("/api/pipeline-progress")
async def pipeline_progress() -> Dict[str, Any]:
    """
    Return live pipeline progress (running, progress %, current_step, steps_done).
    Polled by frontend during deep run.
    """
    p = data_access.get_pipeline_progress()
    return {
        "running": p.get("running", False),
        "progress": p.get("progress", 0),
        "current_step": p.get("current_step", ""),
        "steps_done": p.get("steps_done", []),
        "updated_at": p.get("updated_at"),
    }


@app.post("/api/run-pipeline")
async def run_pipeline(background_tasks: BackgroundTasks) -> Dict[str, Any]:
    """
    Trigger the data_collection pipeline as a background subprocess.

    This endpoint is intentionally fire-and-forget: it returns immediately
    while the Python pipeline collects fresh data from Bright Data.
    """

    def _launch() -> None:
        data_access.write_pipeline_progress_start()
        root = Path(__file__).resolve().parents[1]
        subprocess.Popen(
            ["python", "-m", "data_collection.pipeline", "--jobs", "--business"],
            cwd=str(root),
        )

    background_tasks.add_task(_launch)
    return {"status": "started"}

