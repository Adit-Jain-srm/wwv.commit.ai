"""Comprehensive API endpoint tests with edge case handling."""

from __future__ import annotations

from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient

from backend.main import app


def _client():
    return AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    )


# ── Health ───────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_health_ok() -> None:
    async with _client() as client:
        resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
    assert resp.headers.get("content-type", "").startswith("application/json")


@pytest.mark.asyncio
async def test_health_rejects_post() -> None:
    async with _client() as client:
        resp = await client.post("/health")
    assert resp.status_code in (405, 422)  # Method not allowed or validation error


# ── Jobs endpoint ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_jobs_endpoint_shape() -> None:
    async with _client() as client:
        resp = await client.get("/api/jobs")
    assert resp.status_code == 200
    data = resp.json()
    assert "jobs" in data
    assert "summary" in data
    assert "timeseries" in data
    assert isinstance(data["jobs"], list)
    assert isinstance(data["summary"], dict)
    assert isinstance(data["timeseries"], list)

    summary = data["summary"]
    assert "total_active_postings" in summary
    assert "public_ratio" in summary
    assert "private_ratio" in summary
    assert "top_growing_industry" in summary
    assert "new_businesses_this_month" in summary
    assert "last_updated" in summary


@pytest.mark.asyncio
async def test_jobs_endpoint_empty_data_returns_valid_structure() -> None:
    from backend import data_access
    with patch.object(data_access, "get_jobs_with_summary") as m:
        m.return_value = ([], {"total_active_postings": 0}, [])
        async with _client() as client:
            resp = await client.get("/api/jobs")
    assert resp.status_code == 200
    data = resp.json()
    assert data["jobs"] == []
    assert data["summary"]["total_active_postings"] == 0
    assert data["timeseries"] == []


@pytest.mark.asyncio
async def test_jobs_endpoint_timeseries_structure() -> None:
    from backend import data_access
    timeseries = [{"date": "2026-03-01", "government": 5, "healthcare": 3}]
    with patch.object(data_access, "get_jobs_with_summary") as m:
        m.return_value = ([], {}, timeseries)
        async with _client() as client:
            resp = await client.get("/api/jobs")
    assert resp.status_code == 200
    assert resp.json()["timeseries"] == timeseries


# ── Industries endpoint ───────────────────────────────────────────

@pytest.mark.asyncio
async def test_industries_endpoint_shape() -> None:
    async with _client() as client:
        resp = await client.get("/api/industries")
    assert resp.status_code == 200
    data = resp.json()
    assert "by_industry" in data
    assert "top_industries" in data
    assert isinstance(data["by_industry"], dict)
    assert isinstance(data["top_industries"], list)


@pytest.mark.asyncio
async def test_industries_endpoint_empty_data() -> None:
    from backend import data_access
    with patch.object(data_access, "get_jobs", return_value=[]), \
         patch.object(data_access, "get_trends", return_value={}):
        async with _client() as client:
            resp = await client.get("/api/industries")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data["by_industry"], dict)
    assert isinstance(data["top_industries"], list)


# ── Skills endpoint ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_skills_endpoint_shape() -> None:
    async with _client() as client:
        resp = await client.get("/api/skills")
    assert resp.status_code == 200
    data = resp.json()
    assert "in_demand_skills" in data
    assert "skills_gap" in data
    assert isinstance(data["in_demand_skills"], dict)
    assert isinstance(data["skills_gap"], dict)


# ── Economic signals endpoint ─────────────────────────────────────

@pytest.mark.asyncio
async def test_economic_signals_endpoint_shape() -> None:
    async with _client() as client:
        resp = await client.get("/api/economic-signals")
    assert resp.status_code == 200
    data = resp.json()
    assert "signals" in data
    assert isinstance(data["signals"], list)


@pytest.mark.asyncio
async def test_economic_signals_empty_data() -> None:
    from backend import data_access
    with patch.object(data_access, "get_business_signals", return_value=[]):
        async with _client() as client:
            resp = await client.get("/api/economic-signals")
    assert resp.status_code == 200
    assert resp.json()["signals"] == []


# ── Neighborhoods endpoint ────────────────────────────────────────

@pytest.mark.asyncio
async def test_neighborhoods_endpoint_shape() -> None:
    async with _client() as client:
        resp = await client.get("/api/neighborhoods")
    assert resp.status_code == 200
    data = resp.json()
    assert "neighborhoods" in data
    assert isinstance(data["neighborhoods"], list)
    assert len(data["neighborhoods"]) == 3


@pytest.mark.asyncio
async def test_neighborhoods_each_has_required_fields() -> None:
    async with _client() as client:
        resp = await client.get("/api/neighborhoods")
    assert resp.status_code == 200
    for n in resp.json()["neighborhoods"]:
        assert "name" in n
        assert "job_density_score" in n
        assert "top_sector" in n
        assert isinstance(n["job_density_score"], (int, float))


# ── Insights endpoint ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_insights_requires_data() -> None:
    """When no pipeline output is present, insights should return 503."""
    from backend import data_access

    if data_access.get_jobs() or data_access.get_trends() or data_access.get_business_signals():
        pytest.skip("Pipeline data present, skipping no-data insights test.")

    async with _client() as client:
        resp = await client.get("/api/insights")
    assert resp.status_code == 503
    body = resp.json()
    assert "detail" in body
    assert body["detail"].startswith("No data available")


# ── Pipeline status ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_pipeline_status_endpoint() -> None:
    async with _client() as client:
        resp = await client.get("/api/pipeline-status")
    # 200 regardless of whether pipeline has run
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, dict)


@pytest.mark.asyncio
async def test_ask_requires_question() -> None:
    async with _client() as client:
        resp = await client.post("/api/ask", json={})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_ask_returns_answer() -> None:
    async with _client() as client:
        resp = await client.post(
            "/api/ask",
            json={"question": "What industries are growing fastest in Montgomery?"},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert "answer" in data
    assert isinstance(data["answer"], str)


@pytest.mark.asyncio
async def test_scenario_returns_projected() -> None:
    async with _client() as client:
        resp = await client.post(
            "/api/scenario",
            json={"scenario": "What happens if a new data center opens?"},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert "scenario" in data
    assert "projected" in data
    assert isinstance(data["projected"], dict)

