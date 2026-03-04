"""
Workforce Pulse — Configuration

Montgomery-specific data collection targets aligned with hackathon insights:
  - Government (largest employer sector)
  - Defense & Air Force (Maxwell/Gunter AFB)
  - Manufacturing (Hyundai + suppliers)
  - Big Tech / Data Centers (AWS, Google, Meta expansion)
  - Public Safety (understaffed police, recruitment push)
  - Healthcare, Education (ASU, Baptist Health)
"""

import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BRIGHTDATA_API_TOKEN = os.getenv("BRIGHTDATA_API_TOKEN", "")
BRIGHTDATA_UNLOCKER_ZONE = os.getenv("BRIGHTDATA_UNLOCKER_ZONE", "mcp_unlocker")
BRIGHTDATA_SERP_ZONE = os.getenv("BRIGHTDATA_SERP_ZONE", "serp_api1")

BRIGHTDATA_DC_HOST = os.getenv("BRIGHTDATA_DC_HOST", "brd.superproxy.io")
BRIGHTDATA_DC_PORT = int(os.getenv("BRIGHTDATA_DC_PORT", "33335") or "33335")
BRIGHTDATA_DC_USER = os.getenv("BRIGHTDATA_DC_USER", "")
BRIGHTDATA_DC_PASS = os.getenv("BRIGHTDATA_DC_PASS", "")

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

REGION = "Montgomery, AL"
GEO_LOCATION = "us"

# ── Job collection ───────────────────────────────────────────────
# Queries organized by Montgomery's actual economic sectors.

JOB_SEARCH_QUERIES = [
    # Government (dominant sector — state capital)
    "state government jobs Montgomery Alabama",
    "City of Montgomery government hiring",
    "Montgomery AL public sector employment",
    # Defense & Federal (Maxwell/Gunter AFB)
    "Maxwell Air Force Base jobs Montgomery",
    "Gunter Annex federal jobs Montgomery AL",
    "defense contractor jobs Montgomery Alabama",
    "federal technology jobs Montgomery AL",
    # Manufacturing (Hyundai anchor)
    "Hyundai manufacturing jobs Montgomery AL",
    "Montgomery AL manufacturing plant hiring",
    # Big Tech & Data Centers (emerging)
    "data center jobs Montgomery Alabama",
    "AWS Google Meta jobs Alabama",
    "technology jobs Montgomery AL",
    # Healthcare
    "healthcare jobs Montgomery Alabama",
    "Baptist Health Montgomery hiring",
    # Education
    "Alabama State University jobs Montgomery",
    "education jobs Montgomery AL",
    # Public Safety (understaffed — cross-track)
    "police officer jobs Montgomery Alabama",
    "Montgomery police department hiring",
    "public safety jobs Montgomery AL",
    # General
    "job postings Montgomery AL",
    "hiring Montgomery Alabama 2026",
]

JOB_BOARDS = [
    "https://www.indeed.com/jobs?q=&l=Montgomery%2C+AL&sort=date",
    "https://www.linkedin.com/jobs/jobs-in-montgomery-al",
    "https://jobapscloud.com/MGM/",
    "https://www.montgomerychamber.com/jobs",
    "https://www.usajobs.gov/Search/Results?l=Montgomery%2C%20Alabama",
    "https://personnel.alabama.gov/Jobs",
]

LINKEDIN_JOB_URLS = [
    "https://www.linkedin.com/jobs/search/?location=Montgomery%2C%20Alabama",
    "https://www.linkedin.com/jobs/search/?keywords=government&location=Montgomery%2C%20Alabama",
    "https://www.linkedin.com/jobs/search/?keywords=defense&location=Montgomery%2C%20Alabama",
    "https://www.linkedin.com/jobs/search/?keywords=healthcare&location=Montgomery%2C%20Alabama",
    "https://www.linkedin.com/jobs/search/?keywords=manufacturing&location=Montgomery%2C%20Alabama",
    "https://www.linkedin.com/jobs/search/?keywords=technology+data+center&location=Montgomery%2C%20Alabama",
]

EXTRACT_JOB_URLS = [
    (
        "https://www.indeed.com/jobs?q=&l=Montgomery%2C+AL&sort=date",
        "Extract all job listings: title, company, location, salary, job type, posted date, URL. For each job also note if it is government/public sector, federal/military, healthcare, manufacturing, or private sector.",
    ),
    (
        "https://jobapscloud.com/MGM/",
        "Extract all current government job openings: title, department, salary range, closing date, link. These are City of Montgomery and Montgomery County government positions.",
    ),
    (
        "https://www.usajobs.gov/Search/Results?l=Montgomery%2C%20Alabama",
        "Extract all federal job listings: title, agency, department, grade, salary range, location, closing date, URL.",
    ),
]

# ── Business & economic signals ──────────────────────────────────

BUSINESS_SEARCH_QUERIES = [
    # Business filings / expansion
    "new business filings Montgomery AL 2026",
    "Montgomery Alabama business growth expansion",
    "Montgomery AL new companies opening",
    # Economic development
    "Montgomery Alabama economic development news",
    "Montgomery economic revitalization investment",
    # Data center expansion (strategic concern)
    "data center construction Montgomery Alabama",
    "AWS Google Meta data center Alabama",
    "data center impact Alabama infrastructure",
    # Defense contracting
    "defense contracts Montgomery Alabama 2026",
    "Maxwell Air Force Base contracts Montgomery",
    # Commercial real estate
    "Montgomery AL commercial real estate development",
    # Public safety
    "Montgomery police staffing shortage",
]

MONTGOMERY_COMPANIES_LINKEDIN = [
    # Government
    "https://www.linkedin.com/company/city-of-montgomery-alabama/",
    "https://www.linkedin.com/company/state-of-alabama/",
    # Defense / Federal
    "https://www.linkedin.com/company/maxwell-air-force-base/",
    # Manufacturing
    "https://www.linkedin.com/company/hyundai-motor-manufacturing-alabama/",
    # Healthcare
    "https://www.linkedin.com/company/baptist-health-montgomery/",
    "https://www.linkedin.com/company/jackson-hospital-montgomery/",
    # Education
    "https://www.linkedin.com/company/alabama-state-university/",
    "https://www.linkedin.com/company/auburn-university-at-montgomery/",
    # Big Tech (presence/expansion)
    "https://www.linkedin.com/company/amazon-web-services/",
    "https://www.linkedin.com/company/google/",
    "https://www.linkedin.com/company/meta/",
]

MONTGOMERY_COMPANIES_CRUNCHBASE = [
    "https://www.crunchbase.com/organization/hyundai-motor-manufacturing-alabama",
]

ZILLOW_COMMERCIAL_URLS = [
    "https://www.zillow.com/montgomery-al/commercial/",
]

OPEN_DATA_URLS = [
    "https://opendata.montgomeryal.gov/",
]

EXTRACT_BUSINESS_URLS = [
    (
        "https://opendata.montgomeryal.gov/",
        "Extract all available datasets: name, category, description, last updated date, number of records. Focus on business licenses, permits, economic indicators, employer data, workforce, zoning, land use, public safety, and infrastructure datasets.",
    ),
]

# ── Montgomery local education programs (for skills gap analysis) ─

LOCAL_PROGRAMS = [
    "Alabama State University",
    "Auburn University at Montgomery",
    "Troy University Montgomery",
    "Trenholm State Community College",
    "Faulkner University",
    "Huntingdon College",
]

LOCAL_DEGREE_FIELDS = [
    "nursing", "business administration", "criminal justice",
    "computer science", "information technology", "education",
    "public administration", "social work", "engineering",
    "accounting", "healthcare administration", "cybersecurity",
    "welding", "automotive technology", "hvac",
    "logistics", "supply chain", "data analytics",
]
