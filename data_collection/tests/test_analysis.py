"""Tests for hiring trend analysis and skills extraction."""

import pytest

from data_collection.analysis import (
    compute_hiring_trends,
    extract_industry,
    extract_skills,
    analyze_jobs,
    _normalize_job,
)


class TestNormalizeJob:
    def test_uses_url_from_link(self):
        job = {"title": "Nurse", "link": "https://example.com/job", "source": "serp"}
        out = _normalize_job(job)
        assert out["url"] == "https://example.com/job"
        assert out["title"] == "Nurse"

    def test_uses_url_over_link(self):
        job = {"title": "Dev", "url": "https://a.com", "link": "https://b.com"}
        out = _normalize_job(job)
        assert out["url"] == "https://a.com"

    def test_empty_fields_default_to_empty_string(self):
        job = {"title": "Test"}
        out = _normalize_job(job)
        assert out["company"] == ""
        assert out["location"] == ""


class TestExtractIndustry:
    def test_healthcare(self):
        assert extract_industry("Registered Nurse", "") == "healthcare"
        assert extract_industry("Medical Assistant", "hospital") == "healthcare"

    def test_manufacturing(self):
        assert extract_industry("Machine Operator", "") == "manufacturing"
        assert extract_industry("Warehouse Associate", "distribution") == "manufacturing"

    def test_government(self):
        assert extract_industry("Deputy Sheriff", "") == "government"
        assert extract_industry("City of Montgomery", "personnel") == "government"

    def test_unknown_returns_none(self):
        assert extract_industry("Mysterious Role", "") is None


class TestExtractSkills:
    def test_degree_mention(self):
        skills = extract_skills("Nurse", "bachelor degree required")
        assert any("bachelor" in s.lower() or "degree" in s.lower() for s in skills)

    def test_experience_pattern(self):
        skills = extract_skills("Engineer", "experience 3 years in python")
        assert len(skills) >= 1

    def test_job_type(self):
        skills = extract_skills("Analyst", "full-time position")
        assert any("full" in s.lower() for s in skills)


class TestComputeHiringTrends:
    def test_counts_by_industry(self):
        jobs = [
            {"title": "Nurse", "description": "hospital"},
            {"title": "Nurse", "description": "clinic"},
            {"title": "Machine Operator"},
        ]
        trends = compute_hiring_trends(jobs)
        assert trends["total_jobs"] == 3
        assert "healthcare" in trends["by_industry"]
        assert trends["by_industry"]["healthcare"] >= 2
        assert "manufacturing" in trends["by_industry"]

    def test_empty_jobs(self):
        trends = compute_hiring_trends([])
        assert trends["total_jobs"] == 0
        assert trends["by_industry"] == {}
        assert trends["top_roles"] == []


class TestAnalyzeJobs:
    def test_enriches_with_industry_and_skills(self):
        jobs = [{"title": "Software Developer", "description": "python experience"}]
        enriched, trends = analyze_jobs(jobs)
        assert len(enriched) == 1
        assert enriched[0].get("industry") == "technology"
        assert "skills" in enriched[0]
        assert trends["total_jobs"] == 1
