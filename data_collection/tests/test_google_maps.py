"""Google Maps collector tests with mocked Bright Data client."""

import json
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import pytest

from data_collection.brightdata_client import BrightDataClient
from data_collection.collectors.google_maps import collect_google_maps


SAMPLE_GOOGLE_MAPS_BUSINESS = {
    "name": "Hyundai Motor Manufacturing Alabama",
    "address": "700 Hyundai Blvd, Montgomery, AL 36105",
    "category": "Automobile Manufacturer",
    "rating": 3.9,
    "review_count": 450,
    "phone": "(334) 387-8000",
    "url": "https://www.google.com/maps/place/Hyundai",
}

SAMPLE_GOOGLE_MAPS_REVIEW = {
    "name": "Baptist Health Montgomery",
    "address": "301 Brown Springs Rd, Montgomery, AL 36117",
    "category": "Hospital",
    "rating": 3.5,
    "review_count": 320,
    "review_text": "Good hospital, friendly staff",
    "review_rating": 4,
}

SAMPLE_MAPS_SERP = [
    {
        "title": "Top employers in Montgomery Alabama",
        "link": "https://example.com/employers",
        "description": "Major employers in the Montgomery area",
    },
]


@pytest.fixture
def mock_client():
    client = MagicMock(spec=BrightDataClient)
    client.google_maps_reviews = AsyncMock(return_value=SAMPLE_GOOGLE_MAPS_BUSINESS)
    client.search_batch = AsyncMock(return_value={
        "top employers Montgomery Alabama": SAMPLE_MAPS_SERP,
    })
    return client


@pytest.fixture
def temp_data_dir(monkeypatch):
    with tempfile.TemporaryDirectory() as d:
        path = Path(d)
        monkeypatch.setattr("data_collection.config.DATA_DIR", path)
        monkeypatch.setattr("data_collection.collectors.google_maps.DATA_DIR", path)
        yield path


@pytest.mark.asyncio
async def test_collect_google_maps_basic(mock_client, temp_data_dir):
    """Google Maps collector returns signals and saves files."""
    signals = await collect_google_maps(mock_client)
    assert isinstance(signals, list)
    assert len(signals) >= 1
    assert (temp_data_dir / "google_maps_latest.json").exists()

    with open(temp_data_dir / "google_maps_latest.json") as f:
        saved = json.load(f)
    assert isinstance(saved, list)


@pytest.mark.asyncio
async def test_google_maps_business_fields(mock_client, temp_data_dir):
    """Structured Google Maps data includes address, rating, and category."""
    signals = await collect_google_maps(mock_client)
    structured = [s for s in signals if s.get("source") == "google_maps"]
    assert len(structured) >= 1
    biz = structured[0]
    assert biz["title"] == "Hyundai Motor Manufacturing Alabama"
    assert biz["address"] == "700 Hyundai Blvd, Montgomery, AL 36105"
    assert biz["rating"] == 3.9
    assert biz["review_count"] == 450
    assert biz["category"] == "Automobile Manufacturer"


@pytest.mark.asyncio
async def test_google_maps_serp_signals(mock_client, temp_data_dir):
    """SERP search results are included as signals."""
    signals = await collect_google_maps(mock_client)
    serp = [s for s in signals if s.get("source") == "google_maps_serp"]
    assert len(serp) >= 1


@pytest.mark.asyncio
async def test_google_maps_handles_empty_response(mock_client, temp_data_dir):
    """Empty Google Maps response should not crash."""
    mock_client.google_maps_reviews = AsyncMock(return_value={})
    mock_client.search_batch = AsyncMock(return_value={})
    signals = await collect_google_maps(mock_client)
    assert isinstance(signals, list)


@pytest.mark.asyncio
async def test_google_maps_handles_api_failure(mock_client, temp_data_dir):
    """API failure should not crash the collector."""
    mock_client.google_maps_reviews = AsyncMock(side_effect=Exception("API error"))
    signals = await collect_google_maps(mock_client)
    assert isinstance(signals, list)


@pytest.mark.asyncio
async def test_google_maps_list_response(mock_client, temp_data_dir):
    """Google Maps can return a list of businesses."""
    mock_client.google_maps_reviews = AsyncMock(return_value=[
        SAMPLE_GOOGLE_MAPS_BUSINESS,
        SAMPLE_GOOGLE_MAPS_REVIEW,
    ])
    signals = await collect_google_maps(mock_client)
    structured = [s for s in signals if s.get("source") == "google_maps"]
    assert len(structured) >= 2


@pytest.mark.asyncio
async def test_google_maps_deduplication(mock_client, temp_data_dir):
    """Duplicate businesses are deduplicated by (title, address)."""
    mock_client.google_maps_reviews = AsyncMock(return_value=SAMPLE_GOOGLE_MAPS_BUSINESS)
    signals = await collect_google_maps(mock_client)
    titles = [s["title"] for s in signals if s.get("source") == "google_maps"]
    assert titles.count("Hyundai Motor Manufacturing Alabama") <= 1


@pytest.mark.asyncio
async def test_google_maps_review_text(mock_client, temp_data_dir):
    """Review text is captured when present."""
    mock_client.google_maps_reviews = AsyncMock(return_value=SAMPLE_GOOGLE_MAPS_REVIEW)
    signals = await collect_google_maps(mock_client)
    structured = [s for s in signals if s.get("source") == "google_maps"]
    assert len(structured) >= 1
    assert "review_text" in structured[0]
    assert "Good hospital" in structured[0]["review_text"]
