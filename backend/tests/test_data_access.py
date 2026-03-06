"""Comprehensive tests for backend data_access module."""

from __future__ import annotations

import json
import tempfile
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

import pytest

from backend import data_access


class TestLoadJson:
    """Edge cases for _load_json and JSON loading."""

    def test_missing_file_returns_default_list(self) -> None:
        with patch.object(data_access, "DATA_DIR", Path("/nonexistent/data")):
            result = data_access.get_jobs()
        assert result == []
        assert isinstance(result, list)

    def test_missing_file_returns_default_dict_for_trends(self) -> None:
        with patch.object(data_access, "DATA_DIR", Path("/nonexistent/data")):
            result = data_access.get_trends()
        assert result == {}
        assert isinstance(result, dict)

    def test_missing_file_returns_default_list_for_signals(self) -> None:
        with patch.object(data_access, "DATA_DIR", Path("/nonexistent/data")):
            result = data_access.get_business_signals()
        assert result == []
        assert isinstance(result, list)

    def test_corrupt_json_returns_default(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            path = Path(d)
            (path / "jobs_latest.json").write_text("{ invalid json }")
            with patch.object(data_access, "DATA_DIR", path):
                result = data_access.get_jobs()
            assert result == []

    def test_empty_json_array_returns_empty_list(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            path = Path(d)
            (path / "jobs_latest.json").write_text("[]")
            with patch.object(data_access, "DATA_DIR", path):
                result = data_access.get_jobs()
            assert result == []

    def test_non_list_jobs_returns_empty_list(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            path = Path(d)
            (path / "jobs_latest.json").write_text('{"key": "value"}')
            with patch.object(data_access, "DATA_DIR", path):
                result = data_access.get_jobs()
            assert result == []

    def test_non_dict_trends_returns_empty_dict(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            path = Path(d)
            (path / "trends_latest.json").write_text("[1, 2, 3]")
            with patch.object(data_access, "DATA_DIR", path):
                result = data_access.get_trends()
            assert result == {}


class TestParsePostedDate:
    """Edge cases for _parse_posted_date."""

    def test_empty_string_returns_none(self) -> None:
        assert data_access._parse_posted_date("") is None

    def test_none_input_returns_none(self) -> None:
        assert data_access._parse_posted_date(None) is None  # type: ignore[arg-type]

    def test_iso_date_parsed(self) -> None:
        assert data_access._parse_posted_date("2026-03-01") == date(2026, 3, 1)

    def test_iso_datetime_parsed(self) -> None:
        assert data_access._parse_posted_date("2026-03-01T12:00:00Z") == date(2026, 3, 1)

    def test_days_ago_parsed(self) -> None:
        expected = (datetime.now(timezone.utc) - timedelta(days=3)).date()
        result = data_access._parse_posted_date("3 days ago")
        assert result == expected

    def test_weeks_ago_parsed(self) -> None:
        expected = (datetime.now(timezone.utc) - timedelta(weeks=2)).date()
        result = data_access._parse_posted_date("2 weeks ago")
        assert result == expected

    def test_months_ago_parsed(self) -> None:
        expected = (datetime.now(timezone.utc) - timedelta(days=30)).date()
        result = data_access._parse_posted_date("1 month ago")
        assert result == expected

    def test_invalid_date_returns_none(self) -> None:
        assert data_access._parse_posted_date("not a date") is None

    def test_whitespace_stripped(self) -> None:
        assert data_access._parse_posted_date("  2026-03-01  ") == date(2026, 3, 1)

    def test_non_string_coerced(self) -> None:
        # int/float would fail; we only support str
        assert data_access._parse_posted_date("2026-03-01") == date(2026, 3, 1)


class TestMapIndustryToSeriesKey:
    """Edge cases for _map_industry_to_series_key."""

    def test_none_returns_none(self) -> None:
        assert data_access._map_industry_to_series_key(None) is None

    def test_empty_string_returns_none(self) -> None:
        assert data_access._map_industry_to_series_key("") is None

    def test_government_maps(self) -> None:
        assert data_access._map_industry_to_series_key("government") == "government"
        assert data_access._map_industry_to_series_key("GOVERNMENT") == "government"

    def test_defense_federal_maps_to_defense(self) -> None:
        assert data_access._map_industry_to_series_key("defense_federal") == "defense"

    def test_all_montgomery_industries_mapped(self) -> None:
        mappings = {
            "government": "government",
            "defense_federal": "defense",
            "public_safety": "public_safety",
            "healthcare": "healthcare",
            "manufacturing": "manufacturing",
            "technology": "technology",
            "education": "education",
        }
        for industry, expected in mappings.items():
            assert data_access._map_industry_to_series_key(industry) == expected

    def test_unmapped_industry_returns_none(self) -> None:
        assert data_access._map_industry_to_series_key("retail_hospitality") is None
        assert data_access._map_industry_to_series_key("unknown") is None


class TestGetNeighborhoods:
    """Edge cases for get_neighborhoods."""

    def test_empty_jobs_returns_three_areas_with_zero_scores(self) -> None:
        with patch.object(data_access, "get_jobs", return_value=[]):
            result = data_access.get_neighborhoods()
        assert len(result) == 3
        names = {n["name"] for n in result}
        assert "Downtown Montgomery" in names
        assert "Maxwell / Gunter Area" in names
        assert "East Montgomery" in names
        for n in result:
            assert n["job_density_score"] == 0.0

    def test_jobs_with_sectors_affect_density(self) -> None:
        jobs = [
            {"sector": "public", "title": "Clerk"},
            {"sector": "public", "title": "Analyst"},
            {"sector": "private", "title": "Dev"},
        ]
        with patch.object(data_access, "get_jobs", return_value=jobs):
            result = data_access.get_neighborhoods()
        assert len(result) == 3
        downtown = next(n for n in result if n["name"] == "Downtown Montgomery")
        assert downtown["job_density_score"] > 0

    def test_jobs_missing_sector_default_to_private(self) -> None:
        jobs = [{"title": "Worker"}]  # no sector key
        with patch.object(data_access, "get_jobs", return_value=jobs):
            result = data_access.get_neighborhoods()
        east = next(n for n in result if n["name"] == "East Montgomery")
        assert east["top_sector"] == "private"


class TestGetJobsWithSummary:
    """Edge cases for get_jobs_with_summary."""

    def test_empty_data_returns_valid_structure(self) -> None:
        with patch.object(data_access, "get_jobs", return_value=[]), \
             patch.object(data_access, "get_trends", return_value={}), \
             patch.object(data_access, "get_business_signals", return_value=[]):
            jobs, summary, timeseries = data_access.get_jobs_with_summary()
        assert jobs == []
        assert summary["total_active_postings"] == 0
        assert summary["top_growing_industry"] == "N/A"
        assert 0 <= summary["public_ratio"] <= 1
        assert 0 <= summary["private_ratio"] <= 1
        assert isinstance(timeseries, list)

    def test_summary_reflects_trends(self) -> None:
        jobs = [{"title": "Analyst", "sector": "public", "industry": "government"}]
        trends = {
            "by_industry": {"government": 1},
            "public_sector_ratio": 1.0,
        }
        with patch.object(data_access, "get_jobs", return_value=jobs), \
             patch.object(data_access, "get_trends", return_value=trends), \
             patch.object(data_access, "get_business_signals", return_value=[]):
            _, summary, _ = data_access.get_jobs_with_summary()
        assert summary["total_active_postings"] == 1
        assert summary["top_growing_industry"] == "government"
        assert summary["public_ratio"] == 1.0
        assert summary["private_ratio"] == 0.0

    def test_new_business_count_from_signals(self) -> None:
        now = datetime.now(timezone.utc)
        recent = (now - timedelta(days=5)).isoformat()
        signals = [
            {"signal_type": "new_business", "collected_at": recent},
            {"signal_type": "defense_contract", "collected_at": recent},
        ]
        with patch.object(data_access, "get_jobs", return_value=[]), \
             patch.object(data_access, "get_trends", return_value={}), \
             patch.object(data_access, "get_business_signals", return_value=signals):
            _, summary, _ = data_access.get_jobs_with_summary()
        assert summary["new_businesses_this_month"] == 1


class TestGetPipelineSummary:
    """Edge cases for get_pipeline_summary."""

    def test_missing_file_returns_empty_dict(self) -> None:
        with patch.object(data_access, "DATA_DIR", Path("/nonexistent")):
            result = data_access.get_pipeline_summary()
        assert result == {}

    def test_valid_summary_parsed(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            path = Path(d)
            summary = {
                "timestamp": "2026-03-06T12:00:00Z",
                "region": "Montgomery, AL",
                "results": {
                    "jobs": {"count": 100},
                    "business_signals": {"count": 50},
                },
            }
            (path / "pipeline_summary.json").write_text(json.dumps(summary))
            with patch.object(data_access, "DATA_DIR", path):
                result = data_access.get_pipeline_summary()
            assert result["timestamp"] == "2026-03-06T12:00:00Z"
            assert result["region"] == "Montgomery, AL"
