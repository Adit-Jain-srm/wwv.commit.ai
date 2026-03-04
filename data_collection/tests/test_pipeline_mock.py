"""Pipeline integration tests with mocked Bright Data client."""

import json
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

from data_collection.brightdata_client import BrightDataClient
from data_collection.collectors.jobs import collect_jobs
from data_collection.collectors.business import collect_business_signals


SAMPLE_SEARCH_RESULTS = [
    {"title": "State Government Analyst - Montgomery", "link": "https://example.com/1", "description": "public administration Alabama"},
    {"title": "Hyundai Assembly Operator", "link": "https://example.com/2", "description": "manufacturing plant Montgomery"},
    {"title": "Maxwell AFB IT Specialist", "link": "https://example.com/3", "description": "defense federal technology"},
]

SAMPLE_MARKDOWN = """
### Police Officer
**City of Montgomery**
Montgomery, AL
Full-time
3 days ago

### Data Center Technician
**AWS**
Montgomery, AL
"""

SAMPLE_LINKEDIN_COMPANY = {
    "name": "Hyundai Motor Manufacturing Alabama",
    "url": "https://linkedin.com/company/hmma",
    "description": "Automobile manufacturing plant in Montgomery",
    "employee_count": 3000,
    "industry": "Manufacturing",
    "headquarters": "Montgomery, AL",
}

SAMPLE_CRUNCHBASE = {
    "name": "Test Startup Montgomery",
    "short_description": "Tech startup in Montgomery AL",
    "total_funding": "$5M",
    "num_employees": 50,
}

SAMPLE_ZILLOW = {
    "address": "123 Commerce St, Montgomery AL",
    "price": "$500,000",
    "propertyType": "Commercial",
    "livingArea": 5000,
}


@pytest.fixture
def mock_client():
    client = MagicMock(spec=BrightDataClient)
    client.search_all = AsyncMock(return_value={
        "state government jobs Montgomery Alabama": SAMPLE_SEARCH_RESULTS,
    })
    client.scrape_page = AsyncMock(return_value=SAMPLE_MARKDOWN)
    client.extract = AsyncMock(return_value=SAMPLE_MARKDOWN)
    client.linkedin_job_listing = AsyncMock(return_value=[
        {"title": "Budget Analyst", "company": "City of Montgomery", "location": "Montgomery, AL"},
    ])
    client.linkedin_company_profile = AsyncMock(return_value=SAMPLE_LINKEDIN_COMPANY)
    client.crunchbase_company = AsyncMock(return_value=SAMPLE_CRUNCHBASE)
    client.zillow_listing = AsyncMock(return_value=SAMPLE_ZILLOW)
    return client


@pytest.fixture
def temp_data_dir(monkeypatch):
    with tempfile.TemporaryDirectory() as d:
        path = Path(d)
        monkeypatch.setattr("data_collection.config.DATA_DIR", path)
        monkeypatch.setattr("data_collection.collectors.jobs.DATA_DIR", path)
        monkeypatch.setattr("data_collection.collectors.business.DATA_DIR", path)
        yield path


@pytest.mark.asyncio
async def test_collect_jobs_sector_tagging(mock_client, temp_data_dir):
    """Jobs are enriched with Montgomery-aligned sector and industry."""
    jobs = await collect_jobs(mock_client)
    assert len(jobs) >= 1

    sectors = {j.get("sector") for j in jobs if j.get("sector")}
    assert len(sectors) >= 1

    assert (temp_data_dir / "jobs_latest.json").exists()
    assert (temp_data_dir / "trends_latest.json").exists()

    with open(temp_data_dir / "trends_latest.json") as f:
        trends = json.load(f)
    assert "by_sector" in trends
    assert "public_sector_ratio" in trends
    assert "skills_gap" in trends
    assert "by_industry" in trends


@pytest.mark.asyncio
async def test_collect_jobs_enrichment(mock_client, temp_data_dir):
    jobs = await collect_jobs(mock_client)
    enriched = [j for j in jobs if j.get("industry")]
    assert len(enriched) >= 1


@pytest.mark.asyncio
async def test_collect_business_signal_types(mock_client, temp_data_dir):
    """Business collector classifies Montgomery-specific signal types."""
    mock_client.search_all = AsyncMock(return_value={
        "data center construction Montgomery Alabama": [
            {"title": "AWS Data Center Montgomery", "link": "https://example.com", "description": "data center construction"},
        ],
        "defense contracts Montgomery Alabama 2026": [
            {"title": "Maxwell AFB Contract Award", "link": "https://example.com/2", "description": "defense contract air force"},
        ],
    })
    signals = await collect_business_signals(mock_client)
    assert len(signals) >= 1

    signal_types = {s.get("signal_type") for s in signals}
    assert "data_center" in signal_types or "defense_contract" in signal_types or "company_profile" in signal_types


@pytest.mark.asyncio
async def test_business_linkedin_company(mock_client, temp_data_dir):
    mock_client.search_all = AsyncMock(return_value={})
    signals = await collect_business_signals(mock_client)
    linkedin = [s for s in signals if s.get("source") == "linkedin_company"]
    assert len(linkedin) >= 1
    assert linkedin[0].get("employee_count") == 3000


@pytest.mark.asyncio
async def test_business_crunchbase(mock_client, temp_data_dir):
    mock_client.search_all = AsyncMock(return_value={})
    signals = await collect_business_signals(mock_client)
    cb = [s for s in signals if s.get("source") == "crunchbase"]
    assert len(cb) >= 1
    assert cb[0].get("total_funding") == "$5M"


@pytest.mark.asyncio
async def test_business_zillow(mock_client, temp_data_dir):
    mock_client.search_all = AsyncMock(return_value={})
    signals = await collect_business_signals(mock_client)
    zillow = [s for s in signals if s.get("source") == "zillow"]
    assert len(zillow) >= 1
    assert "123 Commerce St" in zillow[0]["title"]
