"""
Business growth signals collector — PRO_MODE.

Data sources (priority order):
  1. LinkedIn company profiles (structured)
  2. Crunchbase company data (structured)
  3. AI extract from open data portal
  4. Zillow commercial listings (structured)
  5. SERP search for news / filings
  6. Open data portal markdown scrape (fallback)
"""

import json
import logging
from datetime import datetime, timezone

from ..brightdata_client import BrightDataClient
from ..config import (
    BUSINESS_SEARCH_QUERIES,
    DATA_DIR,
    EXTRACT_BUSINESS_URLS,
    GEO_LOCATION,
    MONTGOMERY_COMPANIES_CRUNCHBASE,
    MONTGOMERY_COMPANIES_LINKEDIN,
    OPEN_DATA_URLS,
    ZILLOW_COMMERCIAL_URLS,
)

logger = logging.getLogger(__name__)


async def collect_business_signals(client: BrightDataClient) -> list[dict]:
    """
    Collect business growth signals:
      Phase 1 — LinkedIn company profiles (headcount, growth, about)
      Phase 2 — Crunchbase company data (funding, employees)
      Phase 3 — AI extract from open data portal
      Phase 4 — Zillow commercial real estate
      Phase 5 — SERP search for news / filings / expansion
      Phase 6 — Open data markdown scrape (fallback)
    """
    all_signals: list[dict] = []
    timestamp = datetime.now(timezone.utc).isoformat()

    # ── Phase 1: LinkedIn company profiles ───────────────────────
    logger.info("Phase 1: LinkedIn company profiles...")
    for url in MONTGOMERY_COMPANIES_LINKEDIN:
        try:
            data = await client.linkedin_company_profile(url)
            signals = _parse_linkedin_company(data, url, timestamp)
            logger.info("  %s → %d signals", _short_url(url), len(signals))
            all_signals.extend(signals)
        except Exception as e:
            logger.warning("  LinkedIn company failed for %s: %s", _short_url(url), e)

    # ── Phase 2: Crunchbase company data ─────────────────────────
    logger.info("Phase 2: Crunchbase company data...")
    for url in MONTGOMERY_COMPANIES_CRUNCHBASE:
        try:
            data = await client.crunchbase_company(url)
            signals = _parse_crunchbase(data, url, timestamp)
            logger.info("  %s → %d signals", _short_url(url), len(signals))
            all_signals.extend(signals)
        except Exception as e:
            logger.warning("  Crunchbase failed for %s: %s", _short_url(url), e)

    # ── Phase 3: AI extract from open data ───────────────────────
    logger.info("Phase 3: AI extraction from open data portal...")
    for url, prompt in EXTRACT_BUSINESS_URLS:
        try:
            result = await client.extract(url, prompt)
            if isinstance(result, (dict, list)):
                datasets = _parse_extracted_datasets(result, url)
            else:
                datasets = _extract_datasets(str(result), url)
            for ds in datasets:
                ds["collected_at"] = timestamp
            logger.info("  %s → %d datasets", _short_url(url), len(datasets))
            all_signals.extend(datasets)
        except Exception as e:
            logger.warning("  AI extract failed for %s: %s", _short_url(url), e)

    # ── Phase 4: Zillow commercial real estate ───────────────────
    logger.info("Phase 4: Zillow commercial listings...")
    for url in ZILLOW_COMMERCIAL_URLS:
        try:
            data = await client.zillow_listing(url)
            signals = _parse_zillow(data, url, timestamp)
            logger.info("  %s → %d signals", _short_url(url), len(signals))
            all_signals.extend(signals)
        except Exception as e:
            logger.warning("  Zillow failed for %s: %s", _short_url(url), e)

    # ── Phase 5: SERP search ─────────────────────────────────────
    logger.info("Phase 5: SERP search for business signals...")
    search_results = await client.search_all(BUSINESS_SEARCH_QUERIES, country=GEO_LOCATION)
    for query, results in search_results.items():
        for r in results:
            all_signals.append({
                "title": r.get("title", ""),
                "url": r.get("url") or r.get("link", ""),
                "description": r.get("description", ""),
                "signal_type": _classify_signal(r.get("title", "") + " " + r.get("description", "")),
                "query": query,
                "source": "serp",
                "collected_at": timestamp,
            })
    logger.info("  SERP yielded %d entries", sum(len(v) for v in search_results.values()))

    # ── Phase 6: Open data markdown scrape (fallback) ────────────
    logger.info("Phase 6: Open data portal scrape...")
    for url in OPEN_DATA_URLS:
        try:
            markdown = await client.scrape_page(url)
            datasets = _extract_datasets(markdown, url)
            for ds in datasets:
                ds["collected_at"] = timestamp
            logger.info("  %s → %d dataset refs", _short_url(url), len(datasets))
            all_signals.extend(datasets)
        except Exception as e:
            logger.error("  FAILED to scrape %s: %s", _short_url(url), e)

    # ── Save ─────────────────────────────────────────────────────
    all_signals = _deduplicate_signals(all_signals)
    logger.info("Total unique business signals: %d", len(all_signals))

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    (DATA_DIR / f"business_{ts}.json").write_text(json.dumps(all_signals, indent=2), encoding="utf-8")
    (DATA_DIR / "business_latest.json").write_text(json.dumps(all_signals, indent=2), encoding="utf-8")
    logger.info("Saved business signals to data/")

    return all_signals


# ── Parsing helpers ──────────────────────────────────────────────

def _parse_linkedin_company(data, source_url: str, timestamp: str) -> list[dict]:
    """Extract growth signals from LinkedIn company profile."""
    signals = []
    items = [data] if isinstance(data, dict) else data if isinstance(data, list) else []

    for item in items:
        if not isinstance(item, dict):
            continue
        name = item.get("name") or item.get("company_name", "")
        if not name:
            continue

        signal = {
            "title": name,
            "url": item.get("url") or source_url,
            "description": str(item.get("description") or item.get("about", ""))[:500],
            "source": "linkedin_company",
            "signal_type": "company_profile",
            "collected_at": timestamp,
        }

        employees = item.get("employee_count") or item.get("company_size") or item.get("staff_count")
        if employees:
            signal["employee_count"] = employees

        industry = item.get("industry") or item.get("industries")
        if industry:
            signal["industry"] = industry

        hq = item.get("headquarters") or item.get("hq_location")
        if hq:
            signal["headquarters"] = hq

        specialties = item.get("specialties")
        if specialties:
            signal["specialties"] = specialties

        signals.append(signal)

    return signals


def _parse_crunchbase(data, source_url: str, timestamp: str) -> list[dict]:
    """Extract growth signals from Crunchbase company data."""
    signals = []
    items = [data] if isinstance(data, dict) else data if isinstance(data, list) else []

    for item in items:
        if not isinstance(item, dict):
            continue
        name = item.get("name") or item.get("organization_name", "")
        if not name:
            continue

        signal = {
            "title": name,
            "url": item.get("url") or source_url,
            "description": str(item.get("short_description") or item.get("description", ""))[:500],
            "source": "crunchbase",
            "signal_type": "company_funding",
            "collected_at": timestamp,
        }

        for field in ("total_funding", "funding_rounds", "last_funding_date", "num_employees", "founded_on", "categories", "revenue_range"):
            val = item.get(field)
            if val:
                signal[field] = val

        signals.append(signal)

    return signals


def _parse_zillow(data, source_url: str, timestamp: str) -> list[dict]:
    """Extract real estate growth signals from Zillow."""
    signals = []
    items = data if isinstance(data, list) else [data] if isinstance(data, dict) else []

    for item in items:
        if not isinstance(item, dict):
            continue
        address = item.get("address") or item.get("streetAddress", "")
        if not address:
            continue

        signals.append({
            "title": str(address),
            "url": item.get("url") or item.get("detailUrl") or source_url,
            "description": f"{item.get('propertyType', '')} - {item.get('price', '')}",
            "source": "zillow",
            "signal_type": "real_estate",
            "price": item.get("price"),
            "property_type": item.get("propertyType") or item.get("homeType"),
            "sqft": item.get("livingArea") or item.get("sqft"),
            "collected_at": timestamp,
        })

    return signals


def _parse_extracted_datasets(data, source_url: str) -> list[dict]:
    """Parse structured JSON returned by AI extraction into dataset signals."""
    items = data if isinstance(data, list) else data.get("datasets") or data.get("results") or [data]
    datasets = []
    for item in items:
        if not isinstance(item, dict):
            continue
        name = item.get("name") or item.get("title") or item.get("dataset", "")
        if not name:
            continue
        datasets.append({
            "title": str(name),
            "source": "open_data_extract",
            "source_url": source_url,
            "signal_type": "open_data_reference",
            "category": str(item.get("category", "")),
            "description": str(item.get("description", ""))[:300],
            "last_updated": str(item.get("last_updated") or item.get("updated", "")),
            "record_count": item.get("records") or item.get("number_of_records"),
        })
    return datasets


def _classify_signal(text: str) -> str:
    text_lower = text.lower()
    categories = {
        "new_business": ["new business", "filing", "registered", "incorporation", "startup", "launched"],
        "expansion": ["expansion", "expanding", "new location", "growth", "relocat"],
        "economic_development": ["economic development", "incentive", "grant", "investment", "workforce"],
        "real_estate": ["commercial real estate", "office space", "construction", "development"],
        "hiring_surge": ["hiring", "jobs added", "employment growth", "workforce expansion"],
    }
    for category, keywords in categories.items():
        if any(kw in text_lower for kw in keywords):
            return category
    return "general"


def _extract_datasets(markdown: str, source_url: str) -> list[dict]:
    datasets = []
    business_keywords = ["business", "license", "permit", "economic", "employer", "commercial", "zoning", "development", "workforce"]
    for line in markdown.split("\n"):
        stripped = line.strip()
        if len(stripped) < 10:
            continue
        if any(kw in stripped.lower() for kw in business_keywords):
            datasets.append({
                "title": stripped[:200],
                "source": "open_data",
                "source_url": source_url,
                "signal_type": "open_data_reference",
            })
    return datasets


def _deduplicate_signals(signals: list[dict]) -> list[dict]:
    seen = set()
    unique = []
    for s in signals:
        key = (s.get("title", "").lower().strip(), s.get("source", ""))
        if key not in seen:
            seen.add(key)
            unique.append(s)
    return unique


def _short_url(url: str) -> str:
    return url.split("//")[-1][:50]
