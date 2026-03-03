"""
Bright Data REST API client — PRO_MODE (65 tools).

Supports:
  - search_engine / search_engine_batch
  - scrape_as_markdown / scrape_as_html / scrape_batch
  - extract (AI-powered structured extraction)
  - web_data_* structured datasets (LinkedIn jobs, company profiles,
    Crunchbase, Yahoo Finance, Zillow, Reuters, Google Maps, etc.)
"""

import asyncio
import json
import logging
import re
from typing import Any, Optional
from urllib.parse import quote_plus

import httpx

from .config import (
    BRIGHTDATA_API_TOKEN,
    BRIGHTDATA_DC_HOST,
    BRIGHTDATA_DC_PASS,
    BRIGHTDATA_DC_PORT,
    BRIGHTDATA_DC_USER,
    BRIGHTDATA_SERP_ZONE,
    BRIGHTDATA_UNLOCKER_ZONE,
)

logger = logging.getLogger(__name__)

API_BASE = "https://api.brightdata.com"
MCP_BASE = "https://mcp.brightdata.com"


class BrightDataClient:
    """
    Async client wrapping Bright Data's full API surface.

    Priority order for each operation:
      1. Structured web_data_* endpoints (pre-parsed JSON, cache-backed)
      2. AI extract (scrape + LLM → structured JSON)
      3. SERP API (format=json)
      4. Web Unlocker (scrape as markdown)
    """

    def __init__(
        self,
        api_token: Optional[str] = None,
        zone: Optional[str] = None,
        serp_zone: Optional[str] = None,
    ):
        self.api_token = api_token or BRIGHTDATA_API_TOKEN
        self.zone = zone or BRIGHTDATA_UNLOCKER_ZONE
        self.serp_zone = serp_zone or BRIGHTDATA_SERP_ZONE
        if not self.api_token:
            raise ValueError(
                "BRIGHTDATA_API_TOKEN is required. "
                "Set it in .env or pass it directly."
            )
        self._client: Optional[httpx.AsyncClient] = None

    async def __aenter__(self):
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(120.0, connect=30.0),
            headers={
                "Authorization": f"Bearer {self.api_token}",
                "Content-Type": "application/json",
            },
        )
        return self

    async def __aexit__(self, *exc):
        if self._client:
            await self._client.aclose()

    # ── Search ───────────────────────────────────────────────────

    async def search(self, query: str, country: str = "us") -> list[dict]:
        """Search Google via SERP API → fallback Web Unlocker scrape."""
        encoded = quote_plus(query)
        google_url = f"https://www.google.com/search?q={encoded}&hl=en&gl={country}&num=15"

        try:
            resp = await self._client.post(
                f"{API_BASE}/request",
                json={"zone": self.serp_zone, "url": google_url, "format": "json", "country": country},
            )
            resp.raise_for_status()
            results = _extract_organic_from_serp_json(resp.json())
            if results:
                return results
        except Exception as e:
            logger.debug("SERP API unavailable, falling back: %s", e)

        markdown = await self.scrape_page(google_url)
        return _parse_google_serp(markdown)

    async def search_all(self, queries: list[str], country: str = "us", delay: float = 2.0) -> dict[str, list[dict]]:
        """Run multiple searches with rate-limiting."""
        results: dict[str, list[dict]] = {}
        for q in queries:
            try:
                hits = await self.search(q, country)
                results[q] = hits
                logger.info("  %s → %d results", q, len(hits))
            except Exception as e:
                logger.error("  %s → FAILED: %s", q, e)
                results[q] = []
            await asyncio.sleep(delay)
        return results

    # ── Scraping ─────────────────────────────────────────────────

    async def scrape_page(self, url: str) -> str:
        """Scrape URL → markdown via Web Unlocker."""
        resp = await self._client.post(
            f"{API_BASE}/request",
            json={"zone": self.zone, "url": url, "format": "raw", "data_format": "markdown"},
        )
        resp.raise_for_status()
        return resp.text

    async def fetch_raw(self, url: str) -> str:
        """Scrape URL → raw HTML via Web Unlocker."""
        resp = await self._client.post(
            f"{API_BASE}/request",
            json={"zone": self.zone, "url": url, "format": "raw"},
        )
        resp.raise_for_status()
        return resp.text

    # ── AI Extract (structured JSON from any page) ───────────────

    async def extract(self, url: str, prompt: str) -> Any:
        """
        Scrape + AI extraction → structured JSON.
        Sends extraction_prompt to the Web Unlocker API so the response
        is AI-parsed structured data rather than raw markdown.
        Falls back to plain markdown scrape if the extraction parameter
        is not supported by the current zone.
        """
        payload: dict[str, Any] = {
            "zone": self.zone,
            "url": url,
            "format": "raw",
            "data_format": "markdown",
            "extraction_prompt": prompt,
        }
        try:
            resp = await self._client.post(f"{API_BASE}/request", json=payload)
            resp.raise_for_status()
            try:
                return resp.json()
            except (json.JSONDecodeError, ValueError):
                return resp.text
        except httpx.HTTPStatusError:
            logger.debug("extract with extraction_prompt failed, falling back to plain scrape")
            return await self.scrape_page(url)

    # ── Structured web_data_* endpoints ──────────────────────────
    # Use /datasets/v3/scrape with dataset_id for pre-parsed JSON.
    # Falls back to Web Unlocker markdown scrape on failure.

    DATASET_IDS = {
        "linkedin_job_listings":   "gd_lpfll7v5hcqtkxl6l",
        "linkedin_company":        "gd_l1vikfnt1wgvvqz95w",
        "linkedin_people":         "gd_l1viktl72bvl7bjuj0",
        "indeed_jobs":             "gd_l4dx9j9sscpvs7no2",
        "crunchbase_company":      "gd_l1vijqt9jfj7olije",
        "glassdoor_jobs":          "gd_lpfbbndm1xnopbrcr0",
        "glassdoor_reviews":       "gd_l7j1po0921hbu0ri1z",
        "zillow_listings":         "gd_lfqkr8wm13ixtbd8f5",
        "yahoo_finance":           "gd_lmrpz3vxmz972ghd7",
        "google_maps_reviews":     "gd_luzfs1dn2oa0teb81",
    }

    async def _web_data(self, dataset_key: str, url: str) -> Any:
        """
        Fetch structured data via /datasets/v3/scrape.
        Falls back to Web Unlocker markdown scrape if the dataset call fails.
        """
        dataset_id = self.DATASET_IDS.get(dataset_key)
        if not dataset_id:
            logger.warning("Unknown dataset key '%s', falling back to scrape", dataset_key)
            return await self.scrape_page(url)

        try:
            resp = await self._client.post(
                f"{API_BASE}/datasets/v3/scrape",
                params={"dataset_id": dataset_id, "format": "json", "include_errors": "true"},
                json=[{"url": url}],
            )
            if resp.status_code == 202:
                logger.info("Dataset request accepted async (snapshot pending) for %s", dataset_key)
                return await self.scrape_page(url)
            resp.raise_for_status()
            data = resp.json()
            return data
        except httpx.HTTPStatusError as e:
            logger.warning("Dataset API failed for %s (HTTP %s), falling back to scrape", dataset_key, e.response.status_code)
        except Exception as e:
            logger.warning("Dataset API error for %s: %s, falling back to scrape", dataset_key, e)

        return await self.scrape_page(url)

    async def linkedin_job_listing(self, url: str) -> Any:
        """Structured LinkedIn job listing data."""
        return await self._web_data("linkedin_job_listings", url)

    async def linkedin_company_profile(self, url: str) -> Any:
        """Structured LinkedIn company profile data."""
        return await self._web_data("linkedin_company", url)

    async def crunchbase_company(self, url: str) -> Any:
        """Structured Crunchbase company data."""
        return await self._web_data("crunchbase_company", url)

    async def yahoo_finance(self, url: str) -> Any:
        """Structured Yahoo Finance business data."""
        return await self._web_data("yahoo_finance", url)

    async def zillow_listing(self, url: str) -> Any:
        """Structured Zillow properties listing data."""
        return await self._web_data("zillow_listings", url)

    async def google_maps_reviews(self, url: str, days_limit: str = "30") -> Any:
        """Structured Google Maps reviews."""
        return await self._web_data("google_maps_reviews", url)

    async def reuters_news(self, url: str) -> Any:
        """Structured Reuters news data (via scrape, no dataset)."""
        return await self.scrape_page(url)

    # ── Proxy helper ─────────────────────────────────────────────

    def get_proxy_url(self) -> Optional[str]:
        if not (BRIGHTDATA_DC_USER and BRIGHTDATA_DC_PASS):
            return None
        from urllib.parse import quote
        user = quote(BRIGHTDATA_DC_USER, safe="")
        pwd = quote(BRIGHTDATA_DC_PASS, safe="")
        return f"http://{user}:{pwd}@{BRIGHTDATA_DC_HOST}:{BRIGHTDATA_DC_PORT}"


# ── SERP Parsing (fallback when SERP zone unavailable) ───────────

def _extract_organic_from_serp_json(data) -> list[dict]:
    results = []
    if isinstance(data, dict):
        for key in ("organic", "results", "organic_results"):
            items = data.get(key)
            if isinstance(items, list):
                for r in items:
                    if isinstance(r, dict):
                        title = r.get("title") or r.get("name", "")
                        link = r.get("url") or r.get("link", "")
                        desc = r.get("description", r.get("snippet", ""))
                        if title or link:
                            results.append({"title": str(title), "link": str(link), "description": str(desc), "source_type": "serp_api"})
                break
    return results


def _parse_google_serp(markdown: str) -> list[dict]:
    results = []
    results.extend(_parse_google_jobs_widget(markdown))
    results.extend(_parse_organic_results(markdown))
    seen = set()
    unique = []
    for r in results:
        key = r.get("link", r.get("title", ""))
        if key and key not in seen:
            seen.add(key)
            unique.append(r)
    return unique


def _parse_google_jobs_widget(markdown: str) -> list[dict]:
    jobs = []
    blocks = re.split(r"\]\(https://www\.google\.com/search[^)]*jobs-detail-viewer[^)]*\)", markdown)
    for block in blocks:
        bracket_pos = block.rfind("[")
        if bracket_pos == -1:
            continue
        content = block[bracket_pos + 1:]
        lines = [l.strip() for l in content.split("\n") if l.strip()]
        lines = [l for l in lines if not l.startswith("![") and not l.startswith("*") and not l.startswith("](") and "base64" not in l and len(l) < 200]
        if len(lines) < 2:
            continue
        job: dict = {"source_type": "google_jobs_widget"}
        job["title"] = lines[0]
        if len(lines) > 1:
            job["company"] = lines[1]
        for line in lines[2:]:
            if re.search(r"Montgomery|, AL|via ", line, re.IGNORECASE):
                job["location"] = line
                break
        for line in lines:
            if re.search(r"\d+.*(?:hour|year|an hour|a year)", line, re.IGNORECASE):
                job["pay"] = line
                break
        for line in lines:
            if re.search(r"\d+\s+(?:days?|hours?|weeks?|months?)\s+ago", line, re.IGNORECASE):
                job["posted"] = line
                break
        for line in lines:
            if line in ("Full-time", "Part-time", "Contractor", "Temporary", "Internship"):
                job["job_type"] = line
        if job.get("title") and len(job["title"]) > 3:
            jobs.append(job)
    return jobs


def _parse_organic_results(markdown: str) -> list[dict]:
    results = []
    pattern = re.compile(r"\[\s*###\s+([^\n]+?)\s*\n.*?\]\((https?://(?!www\.google\.com)[^\)]+)\)", re.DOTALL)
    for match in pattern.finditer(markdown):
        title = match.group(1).strip()
        url = match.group(2).strip()
        end_pos = match.end()
        after = markdown[end_pos:end_pos + 500]
        after_lines = [l.strip() for l in after.split("\n") if l.strip()]
        description = ""
        for line in after_lines:
            if line.startswith(("http", "[", "#", "!", "---", "|")):
                continue
            if "›" in line:
                continue
            cleaned = re.sub(r"_([^_]+)_", r"\1", line)
            if len(cleaned) > 30:
                description = cleaned[:300]
                break
        if title and len(title) > 5:
            results.append({"title": title, "link": url, "description": description, "source_type": "organic"})
    return results
