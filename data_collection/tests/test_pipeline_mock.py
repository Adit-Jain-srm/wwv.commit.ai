"""Pipeline integration tests with mocked Bright Data client (no network)."""

import json
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, PropertyMock

import pytest

from data_collection.brightdata_client import BrightDataClient
from data_collection.collectors.jobs import collect_jobs
from data_collection.collectors.business import collect_business_signals


SAMPLE_SEARCH_RESULTS = [
    {"title": "Nurse - Montgomery Hospital", "link": "https://example.com/1", "description": "RN needed in Montgomery AL"},
    {"title": "Machine Operator", "link": "https://example.com/2", "description": "manufacturing plant"},
]

SAMPLE_MARKDOWN = """
### Senior Software Engineer
**Acme Corp**
Montgomery, AL
Full-time
3 days ago

### Warehouse Associate
**Amazon**
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
        "job postings Montgomery AL": SAMPLE_SEARCH_RESULTS,
    })
    client.scrape_page = AsyncMock(return_value=SAMPLE_MARKDOWN)
    client.extract = AsyncMock(return_value=SAMPLE_MARKDOWN)
    client.linkedin_job_listing = AsyncMock(return_value=[
        {"title": "Data Analyst", "company": "Baptist Health", "location": "Montgomery, AL", "url": "https://linkedin.com/jobs/1"},
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
async def test_collect_jobs_all_phases(mock_client, temp_data_dir):
    """Jobs collector uses LinkedIn structured + AI extract + SERP + scrape."""
    jobs = await collect_jobs(mock_client)
    assert len(jobs) >= 1

    sources = {j.get("source") for j in jobs}
    assert "linkedin_structured" in sources or "serp" in sources

    assert (temp_data_dir / "jobs_latest.json").exists()
    assert (temp_data_dir / "trends_latest.json").exists()

    with open(temp_data_dir / "trends_latest.json") as f:
        trends = json.load(f)
    assert "total_jobs" in trends
    assert "by_industry" in trends
    assert "in_demand_skills" in trends


@pytest.mark.asyncio
async def test_collect_jobs_enrichment(mock_client, temp_data_dir):
    """Jobs are enriched with industry and skills."""
    jobs = await collect_jobs(mock_client)
    enriched = [j for j in jobs if j.get("industry")]
    assert len(enriched) >= 1


@pytest.mark.asyncio
async def test_collect_business_all_phases(mock_client, temp_data_dir):
    """Business collector uses LinkedIn + Crunchbase + Zillow + SERP + open data."""
    mock_client.search_all = AsyncMock(return_value={
        "new business filings Montgomery AL 2026": [
            {"title": "New Biz Filing", "link": "https://example.com", "description": "new business Montgomery"},
        ],
    })
    signals = await collect_business_signals(mock_client)
    assert len(signals) >= 1

    sources = {s.get("source") for s in signals}
    assert "linkedin_company" in sources

    assert (temp_data_dir / "business_latest.json").exists()


@pytest.mark.asyncio
async def test_business_linkedin_company_fields(mock_client, temp_data_dir):
    """LinkedIn company profiles include employee count and industry."""
    mock_client.search_all = AsyncMock(return_value={})
    signals = await collect_business_signals(mock_client)
    linkedin_signals = [s for s in signals if s.get("source") == "linkedin_company"]
    assert len(linkedin_signals) >= 1
    assert linkedin_signals[0].get("employee_count") == 3000
    assert linkedin_signals[0].get("industry") == "Manufacturing"


@pytest.mark.asyncio
async def test_business_crunchbase_fields(mock_client, temp_data_dir):
    """Crunchbase data includes funding info."""
    mock_client.search_all = AsyncMock(return_value={})
    signals = await collect_business_signals(mock_client)
    cb_signals = [s for s in signals if s.get("source") == "crunchbase"]
    assert len(cb_signals) >= 1
    assert cb_signals[0].get("total_funding") == "$5M"


@pytest.mark.asyncio
async def test_business_zillow_fields(mock_client, temp_data_dir):
    """Zillow data includes property info."""
    mock_client.search_all = AsyncMock(return_value={})
    signals = await collect_business_signals(mock_client)
    zillow = [s for s in signals if s.get("source") == "zillow"]
    assert len(zillow) >= 1
    assert "123 Commerce St" in zillow[0]["title"]
