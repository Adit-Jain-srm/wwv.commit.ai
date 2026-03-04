"""
Bright Data client — built on the official brightdata-sdk.

Uses the SDK for:
  - search.google / search.linkedin (SERP)
  - scrape.linkedin.jobs / .companies / .profiles
  - datasets.indeed_jobs / .crunchbase_companies / .zillow_properties / etc.
  - scrape_url (Web Unlocker markdown)

Falls back to raw httpx when the SDK method is unavailable.
"""

import asyncio
import json
import logging
import re
from typing import Any, Optional
from urllib.parse import quote_plus

import httpx
from brightdata import BrightDataClient as _SDKClient

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


class BrightDataClient:
    """
    Async client combining the official Bright Data SDK with httpx fallbacks.

    SDK is used for structured data (LinkedIn, Indeed, Crunchbase, etc.)
    and search. httpx is used for Web Unlocker scraping and AI extraction.
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
            raise ValueError("BRIGHTDATA_API_TOKEN is required. Set it in .env or pass it directly.")
        self._http: Optional[httpx.AsyncClient] = None
        self._sdk: Optional[_SDKClient] = None

    async def __aenter__(self):
        self._http = httpx.AsyncClient(
            timeout=httpx.Timeout(120.0, connect=30.0),
            headers={
                "Authorization": f"Bearer {self.api_token}",
                "Content-Type": "application/json",
            },
        )
        self._sdk = _SDKClient(token=self.api_token)
        return self

    async def __aexit__(self, *exc):
        if self._http:
            await self._http.aclose()

    # ── Search (SDK) ─────────────────────────────────────────────

    async def search(self, query: str, country: str = "us") -> list[dict]:
        """Search Google via SDK → fallback to Web Unlocker SERP scrape."""
        try:
            result = self._sdk.search.google(
                query=query,
                location="United States" if country == "us" else country,
                language="en",
                num_results=15,
            )
            if result.success and result.data:
                return [
                    {
                        "title": item.get("title", ""),
                        "link": item.get("url") or item.get("link", ""),
                        "description": item.get("description", ""),
                        "source_type": "sdk_search",
                    }
                    for item in result.data
                    if item.get("title")
                ]
        except Exception as e:
            logger.debug("SDK search failed, falling back to scrape: %s", e)

        encoded = quote_plus(query)
        markdown = await self.scrape_page(
            f"https://www.google.com/search?q={encoded}&hl=en&gl={country}&num=15"
        )
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

    # ── Scraping (httpx — SDK doesn't have async markdown scrape) ─

    async def scrape_page(self, url: str) -> str:
        """Scrape URL → markdown via Web Unlocker."""
        resp = await self._http.post(
            f"{API_BASE}/request",
            json={"zone": self.zone, "url": url, "format": "raw", "data_format": "markdown"},
        )
        resp.raise_for_status()
        return resp.text

    async def fetch_raw(self, url: str) -> str:
        """Scrape URL → raw HTML via Web Unlocker."""
        resp = await self._http.post(
            f"{API_BASE}/request",
            json={"zone": self.zone, "url": url, "format": "raw"},
        )
        resp.raise_for_status()
        return resp.text

    # ── AI Extract (httpx) ───────────────────────────────────────

    async def extract(self, url: str, prompt: str) -> Any:
        """Scrape + AI extraction → structured JSON."""
        payload: dict[str, Any] = {
            "zone": self.zone,
            "url": url,
            "format": "raw",
            "data_format": "markdown",
            "extraction_prompt": prompt,
        }
        try:
            resp = await self._http.post(f"{API_BASE}/request", json=payload)
            resp.raise_for_status()
            try:
                return resp.json()
            except (json.JSONDecodeError, ValueError):
                return resp.text
        except httpx.HTTPStatusError:
            logger.debug("extract with extraction_prompt failed, falling back to plain scrape")
            return await self.scrape_page(url)

    # ── Structured data (SDK datasets + scrape methods) ──────────

    async def linkedin_job_listing(self, url: str) -> Any:
        """Structured LinkedIn job listing via SDK."""
        try:
            result = self._sdk.scrape.linkedin.jobs_sync(url=[url])
            if result.success and result.data:
                return result.data
        except Exception as e:
            logger.debug("SDK linkedin.jobs failed: %s", e)
        return await self._dataset_fallback("gd_lpfll7v5hcqtkxl6l", url)

    async def linkedin_company_profile(self, url: str) -> Any:
        """Structured LinkedIn company profile via SDK."""
        try:
            result = self._sdk.scrape.linkedin.companies_sync(url=[url])
            if result.success and result.data:
                return result.data
        except Exception as e:
            logger.debug("SDK linkedin.companies failed: %s", e)
        return await self._dataset_fallback("gd_l1vikfnt1wgvvqz95w", url)

    async def crunchbase_company(self, url: str) -> Any:
        """Structured Crunchbase company data via SDK."""
        try:
            result = self._sdk.datasets.crunchbase_companies(url=[url])
            if result.success and result.data:
                return result.data
        except Exception as e:
            logger.debug("SDK crunchbase failed: %s", e)
        return await self._dataset_fallback("gd_l1vijqt9jfj7olije", url)

    async def indeed_jobs(self, url: str) -> Any:
        """Structured Indeed job listings via SDK."""
        try:
            result = self._sdk.datasets.indeed_jobs(url=[url])
            if result.success and result.data:
                return result.data
        except Exception as e:
            logger.debug("SDK indeed_jobs failed: %s", e)
        return await self._dataset_fallback("gd_l4dx9j9sscpvs7no2", url)

    async def zillow_listing(self, url: str) -> Any:
        """Structured Zillow listing via SDK."""
        try:
            result = self._sdk.datasets.zillow_properties(url=[url])
            if result.success and result.data:
                return result.data
        except Exception as e:
            logger.debug("SDK zillow failed: %s", e)
        return await self._dataset_fallback("gd_lfqkr8wm13ixtbd8f5", url)

    async def glassdoor_jobs(self, url: str) -> Any:
        """Structured Glassdoor job listings via SDK."""
        try:
            result = self._sdk.datasets.glassdoor_jobs(url=[url])
            if result.success and result.data:
                return result.data
        except Exception as e:
            logger.debug("SDK glassdoor_jobs failed: %s", e)
        return await self._dataset_fallback("gd_lpfbbndm1xnopbrcr0", url)

    async def yahoo_finance(self, url: str) -> Any:
        """Structured Yahoo Finance data."""
        return await self._dataset_fallback("gd_lmrpz3vxmz972ghd7", url)

    async def google_maps_reviews(self, url: str, days_limit: str = "30") -> Any:
        """Structured Google Maps reviews via SDK."""
        try:
            result = self._sdk.datasets.google_maps_reviews(url=[url])
            if result.success and result.data:
                return result.data
        except Exception as e:
            logger.debug("SDK google_maps_reviews failed: %s", e)
        return await self._dataset_fallback("gd_luzfs1dn2oa0teb81", url)

    async def linkedin_search_jobs(self, keyword: str, location: str = "Montgomery, Alabama") -> Any:
        """Search LinkedIn jobs via SDK (discovery, no URL needed)."""
        try:
            result = self._sdk.search.linkedin.jobs_sync(
                keyword=keyword,
                location=location,
            )
            if result.success and result.data:
                return result.data
        except Exception as e:
            logger.debug("SDK linkedin job search failed: %s", e)
        return []

    # ── Dataset API fallback (httpx) ─────────────────────────────

    async def _dataset_fallback(self, dataset_id: str, url: str) -> Any:
        """Direct dataset API call via httpx, falls back to scrape."""
        try:
            resp = await self._http.post(
                f"{API_BASE}/datasets/v3/scrape",
                params={"dataset_id": dataset_id, "format": "json", "include_errors": "true"},
                json=[{"url": url}],
            )
            if resp.status_code == 202:
                logger.info("Dataset async (snapshot pending), falling back to scrape")
                return await self.scrape_page(url)
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            logger.warning("Dataset API fallback failed: %s, scraping instead", e)
            return await self.scrape_page(url)

    # ── Proxy helper ─────────────────────────────────────────────

    def get_proxy_url(self) -> Optional[str]:
        if not (BRIGHTDATA_DC_USER and BRIGHTDATA_DC_PASS):
            return None
        from urllib.parse import quote
        user = quote(BRIGHTDATA_DC_USER, safe="")
        pwd = quote(BRIGHTDATA_DC_PASS, safe="")
        return f"http://{user}:{pwd}@{BRIGHTDATA_DC_HOST}:{BRIGHTDATA_DC_PORT}"


# ── SERP Parsing (fallback when SDK search unavailable) ──────────

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
