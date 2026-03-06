"""Comprehensive tests for markdown and SERP parsing (no network)."""

import pytest

from data_collection.brightdata_client import (
    _parse_google_serp,
    _parse_google_jobs_widget,
    _parse_organic_results,
)


SAMPLE_JOBS_WIDGET = """
[
Shipping And Receiving Clerk
Aerotek
Montgomery, AL • via Aerotek Jobs
3 days ago
17 an hour
Contractor
](https://www.google.com/search?q=jobs&udm=8#vhid=vt%3D20/docid%3Dabc&vssid=jobs-detail-viewer)
"""


SAMPLE_ORGANIC = """
[
### 6000 Jobs, Employment in Montgomery, AL
Indeed
https://www.indeed.com › l-montgomery,-al-jobs
](https://www.indeed.com/l-montgomery,-al-jobs.html)

Indeed
_6918 jobs available in Montgomery, AL on Indeed.com._
"""


MALFORMED_MARKDOWN = "Not valid markdown [[]] broken [["
EMPTY_LINK_SECTION = "[](https://example.com)"
NO_LINKS = "Just plain text with no links"


class TestParseGoogleJobsWidget:
    def test_extracts_title_and_company(self):
        jobs = _parse_google_jobs_widget(SAMPLE_JOBS_WIDGET)
        assert len(jobs) >= 1
        j = jobs[0]
        assert "Shipping" in j["title"] or "Clerk" in j["title"]
        assert "Aerotek" in j.get("company", "")

    def test_empty_input_returns_empty(self):
        assert _parse_google_jobs_widget("") == []

    def test_whitespace_only_returns_empty(self):
        assert _parse_google_jobs_widget("   \n\t  ") == []

    def test_malformed_input_returns_empty_or_partial(self):
        result = _parse_google_jobs_widget(MALFORMED_MARKDOWN)
        assert isinstance(result, list)
        # Should not raise; may return empty or partial

    def test_extracted_job_has_title_and_url(self):
        jobs = _parse_google_jobs_widget(SAMPLE_JOBS_WIDGET)
        for j in jobs:
            assert "title" in j or "link" in j or "url" in j
            # At least one identifier present

    def test_none_input_handled(self):
        # May raise or return []; we expect no crash
        try:
            result = _parse_google_jobs_widget(None)
            assert isinstance(result, list)
        except (TypeError, AttributeError):
            pass  # Acceptable to reject None


class TestParseOrganicResults:
    def test_extracts_title_and_url(self):
        results = _parse_organic_results(SAMPLE_ORGANIC)
        assert len(results) >= 1
        r = results[0]
        assert "6000" in r["title"] or "Jobs" in r["title"]
        assert "indeed.com" in r["link"]

    def test_empty_input_returns_empty(self):
        assert _parse_organic_results("") == []

    def test_no_links_returns_empty(self):
        result = _parse_organic_results(NO_LINKS)
        assert isinstance(result, list)
        assert len(result) == 0


class TestParseGoogleSerp:
    def test_combines_jobs_and_organic(self):
        md = SAMPLE_JOBS_WIDGET + "\n\n" + SAMPLE_ORGANIC
        results = _parse_google_serp(md)
        assert len(results) >= 1
        titles = [r.get("title", "") for r in results]
        assert any("6000" in t or "Indeed" in t or "Shipping" in t or "Clerk" in t for t in titles)

    def test_empty_input_returns_empty(self):
        assert _parse_google_serp("") == []

    def test_each_result_has_expected_keys(self):
        md = SAMPLE_JOBS_WIDGET + "\n\n" + SAMPLE_ORGANIC
        results = _parse_google_serp(md)
        for r in results:
            assert isinstance(r, dict)
            assert "title" in r or "link" in r
