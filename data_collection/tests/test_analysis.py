"""Tests for Montgomery-aligned analysis engine."""

import pytest

from data_collection.analysis import (
    classify_sector,
    compute_hiring_trends,
    detect_skills_gap,
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

    def test_uses_url_over_link(self):
        job = {"title": "Dev", "url": "https://a.com", "link": "https://b.com"}
        out = _normalize_job(job)
        assert out["url"] == "https://a.com"

    def test_preserves_department(self):
        job = {"title": "Analyst", "department": "Finance"}
        out = _normalize_job(job)
        assert out["department"] == "Finance"


class TestExtractIndustry:
    def test_government(self):
        assert extract_industry("City of Montgomery Clerk") == "government"
        assert extract_industry("State of Alabama Personnel") == "government"

    def test_defense(self):
        assert extract_industry("Maxwell Air Force Base Technician") == "defense_federal"

    def test_public_safety(self):
        assert extract_industry("Police Officer", "law enforcement Montgomery") == "public_safety"

    def test_healthcare(self):
        assert extract_industry("Registered Nurse", "Baptist Health") == "healthcare"

    def test_manufacturing(self):
        assert extract_industry("Hyundai Assembly Worker") == "manufacturing"

    def test_technology(self):
        assert extract_industry("Data Center Technician", "cloud infrastructure") == "technology"

    def test_education(self):
        assert extract_industry("Professor", "Alabama State University") == "education"

    def test_unknown_returns_none(self):
        assert extract_industry("Mysterious Role") is None


class TestClassifySector:
    def test_public_sector(self):
        assert classify_sector("Budget Analyst", "City of Montgomery") == "public"

    def test_federal_sector(self):
        assert classify_sector("IT Specialist", "Maxwell Air Force Base") == "federal"
        assert classify_sector("Engineer", source="usajobs") == "federal"

    def test_private_sector(self):
        assert classify_sector("Cashier", "Walmart") == "private"


class TestExtractSkills:
    def test_degree_mention(self):
        skills = extract_skills("Nurse", "bachelor degree required")
        assert any("bachelor" in s for s in skills)

    def test_clearance(self):
        skills = extract_skills("Analyst", "security clearance required")
        assert any("clearance" in s for s in skills)

    def test_job_type(self):
        skills = extract_skills("Worker", "full-time position")
        assert any("full" in s for s in skills)


class TestSkillsGap:
    def test_gap_detected(self):
        gaps = detect_skills_gap(["python", "security clearance", "nursing"])
        gap_skills = [g["skill"] for g in gaps if g["gap"]]
        has_training = [g["skill"] for g in gaps if not g["gap"]]
        assert "security clearance" in gap_skills
        assert "nursing" in has_training


class TestComputeHiringTrends:
    def test_sector_breakdown(self):
        jobs = [
            {"title": "City of Montgomery Clerk", "company": "City of Montgomery"},
            {"title": "Software Dev", "company": "Google"},
            {"title": "Maxwell AFB Tech", "company": "Air Force"},
        ]
        trends = compute_hiring_trends(jobs)
        assert trends["total_jobs"] == 3
        assert "by_sector" in trends
        assert "public_sector_ratio" in trends
        assert "skills_gap" in trends

    def test_empty(self):
        trends = compute_hiring_trends([])
        assert trends["total_jobs"] == 0


class TestAnalyzeJobs:
    def test_enriches_with_sector_and_industry(self):
        jobs = [
            {"title": "Police Officer", "company": "City of Montgomery", "description": "law enforcement"},
            {"title": "Hyundai Assembly Worker", "description": "manufacturing plant"},
        ]
        enriched, trends = analyze_jobs(jobs)
        assert len(enriched) == 2
        assert enriched[0]["sector"] == "public"
        assert enriched[0]["industry"] == "public_safety"
        assert enriched[1]["industry"] == "manufacturing"
        assert trends["total_jobs"] == 2
