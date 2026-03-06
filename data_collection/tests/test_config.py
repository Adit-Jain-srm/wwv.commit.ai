"""Tests for data_collection config module."""

import pytest

from data_collection import config


class TestConfigConstants:
    """Config constants are set and non-empty where expected."""

    def test_data_dir_exists(self):
        assert config.DATA_DIR.exists()
        assert config.DATA_DIR.is_dir()

    def test_region_set(self):
        assert config.REGION == "Montgomery, AL"

    def test_geo_location_set(self):
        assert config.GEO_LOCATION in ("us", "US", "United States") or len(config.GEO_LOCATION) >= 2

    def test_job_search_queries_non_empty(self):
        assert len(config.JOB_SEARCH_QUERIES) >= 1
        for q in config.JOB_SEARCH_QUERIES:
            assert isinstance(q, str)
            assert len(q) > 5

    def test_job_boards_non_empty(self):
        assert len(config.JOB_BOARDS) >= 1
        for url in config.JOB_BOARDS:
            assert "http" in url

    def test_linkedin_job_urls_non_empty(self):
        assert len(config.LINKEDIN_JOB_URLS) >= 1
        for url in config.LINKEDIN_JOB_URLS:
            assert "linkedin.com" in url

    def test_local_degree_fields_non_empty(self):
        assert len(config.LOCAL_DEGREE_FIELDS) >= 1
        for f in config.LOCAL_DEGREE_FIELDS:
            assert isinstance(f, str)
            assert len(f) > 2

    def test_local_programs_non_empty(self):
        assert len(config.LOCAL_PROGRAMS) >= 1
        for p in config.LOCAL_PROGRAMS:
            assert "Montgomery" in p or "Alabama" in p or "University" in p or "College" in p


class TestMontgomeryAlignment:
    """Config reflects Montgomery economic priorities."""

    def test_government_queries_present(self):
        queries = " ".join(config.JOB_SEARCH_QUERIES)
        assert "government" in queries.lower() or "Montgomery" in queries

    def test_defense_queries_present(self):
        queries = " ".join(config.JOB_SEARCH_QUERIES)
        assert "maxwell" in queries.lower() or "defense" in queries.lower() or "federal" in queries.lower()

    def test_healthcare_queries_present(self):
        queries = " ".join(config.JOB_SEARCH_QUERIES)
        assert "healthcare" in queries.lower() or "baptist" in queries.lower()
