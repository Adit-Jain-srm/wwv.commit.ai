"""Comprehensive tests for Montgomery-aligned analysis engine."""

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
    """Edge cases for job schema normalization."""

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

    def test_missing_title_uses_name(self):
        job = {"name": "Software Engineer", "link": "https://x.com"}
        out = _normalize_job(job)
        assert out["title"] == "Software Engineer"

    def test_empty_values_become_empty_strings(self):
        job = {}
        out = _normalize_job(job)
        assert out["title"] == ""
        assert out["url"] == ""
        assert out["company"] == ""
        assert out["description"] == ""

    def test_non_string_fields_coerced(self):
        job = {"title": 123, "company": None, "description": 45.5}
        out = _normalize_job(job)
        assert out["title"] == "123"
        assert out["description"] == "45.5"
        # company: None → str(None) == "None" (key present)
        assert out["company"] == "None"

    def test_whitespace_stripped(self):
        job = {"title": "  Nurse  ", "company": "  Hospital  "}
        out = _normalize_job(job)
        assert out["title"] == "Nurse"
        assert out["company"] == "Hospital"

    def test_source_defaults_to_unknown(self):
        job = {"title": "Worker"}
        out = _normalize_job(job)
        assert out["source"] == "unknown"

    def test_source_type_used_when_source_missing(self):
        job = {"title": "Worker", "source_type": "linkedin"}
        out = _normalize_job(job)
        assert out["source"] == "linkedin"

    def test_all_required_keys_present(self):
        job = {"title": "T"}
        out = _normalize_job(job)
        required = ("title", "url", "company", "location", "description", "pay", "posted", "job_type", "department", "source")
        for k in required:
            assert k in out


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

    def test_empty_string_returns_none(self):
        assert extract_industry("") is None
        assert extract_industry("", "") is None

    def test_highest_score_wins_tiebreaker(self):
        # government vs healthcare - whichever scores more
        text = "City of Montgomery Nurse at Baptist Health"
        result = extract_industry(text)
        assert result in ("government", "healthcare")

    def test_retail_hospitality(self):
        assert extract_industry("Cashier", "retail store") == "retail_hospitality"
        assert extract_industry("Server", "restaurant food service") == "retail_hospitality"

    def test_transportation(self):
        assert extract_industry("CDL Driver", "truck delivery") == "transportation"

    def test_construction_trades(self):
        assert extract_industry("Electrician", "HVAC maintenance") == "construction_trades"


class TestClassifySector:
    def test_public_sector(self):
        assert classify_sector("Budget Analyst", "City of Montgomery") == "public"

    def test_federal_sector(self):
        assert classify_sector("IT Specialist", "Maxwell Air Force Base") == "federal"
        assert classify_sector("Engineer", source="usajobs") == "federal"

    def test_federal_beats_public(self):
        """Federal jobs mentioning 'public' should be federal, not public."""
        assert classify_sector("Public Affairs Officer", "Maxwell Air Force Base") == "federal"

    def test_private_with_public_in_description(self):
        """Private jobs mentioning 'public' in common phrases stay private."""
        assert classify_sector("Sales Rep", "Acme Corp", "public speaking skills required") == "private"
        assert classify_sector("PR Manager", "Tech Inc", "public relations experience") == "private"
        assert classify_sector("Receptionist", "Hotel", "public-facing role") == "private"

    def test_private_sector(self):
        assert classify_sector("Cashier", "Walmart") == "private"

    def test_empty_input_defaults_to_private(self):
        assert classify_sector("", "", "", "") == "private"

    def test_source_usajobs_implies_federal(self):
        assert classify_sector("Random Job", "Acme", "", "usajobs") == "federal"

    def test_va_veterans_affairs_federal(self):
        assert classify_sector("VA Nurse", "Veterans Affairs") == "federal"


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

    def test_empty_input_returns_empty_list(self):
        assert extract_skills("") == []
        assert extract_skills("", "") == []

    def test_python_java_sql_detected(self):
        skills = extract_skills("Developer", "python java sql required")
        tech = [s for s in skills if s in ("python", "java", "sql")]
        assert len(tech) >= 1

    def test_experience_years_pattern(self):
        skills = extract_skills("Manager", "5 years experience required")
        assert len(skills) >= 1

    def test_caps_skills_deduplicated(self):
        skills = extract_skills("Dev", "Python python PYTHON")
        python_count = sum(1 for s in skills if "python" in s.lower())
        assert python_count <= 1

    def test_max_twelve_skills_returned(self):
        long_desc = "python java sql excel word outlook certification bachelor degree full-time remote hybrid"
        skills = extract_skills("Dev", long_desc)
        assert len(skills) <= 12


class TestSkillsGap:
    def test_gap_detected(self):
        gaps = detect_skills_gap(["python", "security clearance", "nursing"])
        gap_skills = [g["skill"] for g in gaps if g["gap"]]
        has_training = [g["skill"] for g in gaps if not g["gap"]]
        assert "security clearance" in gap_skills
        assert "nursing" in has_training

    def test_empty_list_returns_empty(self):
        assert detect_skills_gap([]) == []

    def test_each_skill_has_required_keys(self):
        gaps = detect_skills_gap(["python", "welding"])
        for g in gaps:
            assert "skill" in g
            assert "gap" in g
            assert "local_training_available" in g

    def test_cybersecurity_has_local_training(self):
        gaps = detect_skills_gap(["cybersecurity"])
        assert len(gaps) == 1
        assert gaps[0]["local_training_available"] is True
        assert gaps[0]["gap"] is False


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
        assert trends["by_industry"] == {}
        assert trends["by_sector"] == {}
        assert trends["public_sector_ratio"] == 0
        assert "skills_gap" in trends
        assert "in_demand_skills" in trends
        assert "top_roles" in trends
        assert "top_companies" in trends

    def test_jobs_without_title_filtered_out(self):
        jobs = [
            {"title": "Analyst", "company": "City"},
            {"title": "", "company": "Corp"},
            {"company": "NoTitle"},
        ]
        trends = compute_hiring_trends(jobs)
        assert trends["total_jobs"] == 1

    def test_public_sector_ratio_computed(self):
        jobs = [
            {"title": "Clerk", "company": "City of Montgomery"},
            {"title": "Dev", "company": "Acme"},
        ]
        trends = compute_hiring_trends(jobs)
        assert 0 <= trends["public_sector_ratio"] <= 1
        assert trends["total_jobs"] == 2

    def test_by_source_populated(self):
        jobs = [
            {"title": "A", "company": "X", "source": "serp"},
            {"title": "B", "company": "Y", "source": "linkedin"},
        ]
        trends = compute_hiring_trends(jobs)
        assert "by_source" in trends
        assert trends["by_source"].get("serp") == 1
        assert trends["by_source"].get("linkedin") == 1


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

    def test_empty_list_returns_empty_enriched_and_trends(self):
        enriched, trends = analyze_jobs([])
        assert enriched == []
        assert trends["total_jobs"] == 0

    def test_each_job_gets_sector_industry_skills(self):
        jobs = [{"title": "Nurse", "company": "Hospital", "description": "RN required"}]
        enriched, _ = analyze_jobs(jobs)
        assert len(enriched) == 1
        j = enriched[0]
        assert "sector" in j
        assert "industry" in j
        assert "skills" in j
        assert isinstance(j["skills"], list)

    def test_jobs_without_title_filtered(self):
        jobs = [
            {"title": "Good Job", "company": "A"},
            {"title": "", "company": "B"},
        ]
        enriched, trends = analyze_jobs(jobs)
        assert len(enriched) == 1
        assert trends["total_jobs"] == 1
