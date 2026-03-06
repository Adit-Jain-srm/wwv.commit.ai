"""Glassdoor collector tests with mocked Bright Data client."""

import json
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

from data_collection.brightdata_client import BrightDataClient
from data_collection.collectors.glassdoor import collect_glassdoor


SAMPLE_GLASSDOOR_EMPLOYER = {
    "employer_name": "Hyundai Motor Manufacturing Alabama",
    "url": "https://www.glassdoor.com/Overview/hyundai-hmma",
    "overall_rating": 3.8,
    "culture_rating": 3.5,
    "work_life_balance_rating": 3.2,
    "compensation_rating": 4.0,
    "review_count": 250,
    "industry": "Manufacturing",
    "headquarters": "Montgomery, AL",
    "pros": "Good pay and benefits",
    "cons": "Long shifts",
}

SAMPLE_GLASSDOOR_SERP = [
    {
        "title": "Glassdoor: City of Montgomery Reviews",
        "link": "https://www.glassdoor.com/Reviews/city-of-montgomery",
        "description": "3.5 rating - 120 reviews - government employer",
    },
]


@pytest.fixture
def mock_client():
    client = MagicMock(spec=BrightDataClient)
    client.glassdoor_jobs = AsyncMock(return_value=SAMPLE_GLASSDOOR_EMPLOYER)
    client.search_batch = AsyncMock(return_value={
        "Glassdoor reviews City of Montgomery Alabama employer": SAMPLE_GLASSDOOR_SERP,
    })
    return client


@pytest.fixture
def temp_data_dir(monkeypatch):
    with tempfile.TemporaryDirectory() as d:
        path = Path(d)
        monkeypatch.setattr("data_collection.config.DATA_DIR", path)
        monkeypatch.setattr("data_collection.collectors.glassdoor.DATA_DIR", path)
        yield path


@pytest.mark.asyncio
async def test_collect_glassdoor_basic(mock_client, temp_data_dir):
    """Glassdoor collector returns signals and saves files."""
    signals = await collect_glassdoor(mock_client)
    assert isinstance(signals, list)
    assert len(signals) >= 1
    assert (temp_data_dir / "glassdoor_latest.json").exists()

    with open(temp_data_dir / "glassdoor_latest.json") as f:
        saved = json.load(f)
    assert isinstance(saved, list)


@pytest.mark.asyncio
async def test_glassdoor_employer_fields(mock_client, temp_data_dir):
    """Structured Glassdoor data includes rating and review_count."""
    signals = await collect_glassdoor(mock_client)
    structured = [s for s in signals if s.get("source") == "glassdoor"]
    assert len(structured) >= 1
    assert structured[0]["title"] == "Hyundai Motor Manufacturing Alabama"
    assert structured[0]["overall_rating"] == 3.8
    assert structured[0]["review_count"] == 250


@pytest.mark.asyncio
async def test_glassdoor_serp_signals(mock_client, temp_data_dir):
    """SERP search results are included as signals."""
    signals = await collect_glassdoor(mock_client)
    serp = [s for s in signals if s.get("source") == "glassdoor_serp"]
    assert len(serp) >= 1


@pytest.mark.asyncio
async def test_glassdoor_handles_empty_response(mock_client, temp_data_dir):
    """Empty Glassdoor response should not crash."""
    mock_client.glassdoor_jobs = AsyncMock(return_value={})
    mock_client.search_batch = AsyncMock(return_value={})
    signals = await collect_glassdoor(mock_client)
    assert isinstance(signals, list)


@pytest.mark.asyncio
async def test_glassdoor_handles_api_failure(mock_client, temp_data_dir):
    """API failure should not crash the collector."""
    mock_client.glassdoor_jobs = AsyncMock(side_effect=Exception("API error"))
    signals = await collect_glassdoor(mock_client)
    assert isinstance(signals, list)


@pytest.mark.asyncio
async def test_glassdoor_deduplication(mock_client, temp_data_dir):
    """Duplicate signals are deduplicated."""
    # Return same employer data from multiple URLs
    mock_client.glassdoor_jobs = AsyncMock(return_value=SAMPLE_GLASSDOOR_EMPLOYER)
    signals = await collect_glassdoor(mock_client)
    titles = [s["title"] for s in signals if s.get("source") == "glassdoor"]
    # Even though we call glassdoor_jobs for each URL in config, the dedup should collapse them
    assert titles.count("Hyundai Motor Manufacturing Alabama") <= 1


@pytest.mark.asyncio
async def test_glassdoor_signal_type_classification(mock_client, temp_data_dir):
    """SERP signals get classified by type."""
    mock_client.search_batch = AsyncMock(return_value={
        "q1": [
            {"title": "Salary data for Montgomery employers", "link": "https://example.com", "description": "salary compensation"},
            {"title": "Interview questions at Hyundai", "link": "https://example.com/2", "description": "interview hiring process"},
        ],
    })
    signals = await collect_glassdoor(mock_client)
    signal_types = {s.get("signal_type") for s in signals if s.get("source") == "glassdoor_serp"}
    assert "salary_data" in signal_types or "interview_data" in signal_types
