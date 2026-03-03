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

JOB_SEARCH_QUERIES = [
    "job postings Montgomery AL",
    "LinkedIn jobs Montgomery Alabama",
    "hiring Montgomery Alabama 2026",
    "Montgomery AL employment opportunities",
    "new jobs Montgomery region Alabama",
    "Montgomery AL healthcare jobs",
    "Montgomery AL manufacturing jobs",
    "Montgomery AL technology jobs",
    "Montgomery AL government jobs",
]

JOB_BOARDS = [
    "https://www.indeed.com/jobs?q=&l=Montgomery%2C+AL&sort=date",
    "https://www.linkedin.com/jobs/jobs-in-montgomery-al",
    "https://jobapscloud.com/MGM/",
    "https://www.montgomerychamber.com/jobs",
]

LINKEDIN_JOB_URLS = [
    "https://www.linkedin.com/jobs/search/?location=Montgomery%2C%20Alabama",
    "https://www.linkedin.com/jobs/search/?keywords=healthcare&location=Montgomery%2C%20Alabama",
    "https://www.linkedin.com/jobs/search/?keywords=manufacturing&location=Montgomery%2C%20Alabama",
    "https://www.linkedin.com/jobs/search/?keywords=technology&location=Montgomery%2C%20Alabama",
]

# Pages to use with AI extract (structured job data from arbitrary boards)
EXTRACT_JOB_URLS = [
    ("https://www.indeed.com/jobs?q=&l=Montgomery%2C+AL&sort=date", "Extract all job listings: title, company, location, salary, job type, posted date, and URL for each job."),
    ("https://jobapscloud.com/MGM/", "Extract all current job openings: title, department, salary range, closing date, and link for each position."),
]

# ── Business signals ─────────────────────────────────────────────

BUSINESS_SEARCH_QUERIES = [
    "new business filings Montgomery AL 2026",
    "Montgomery Alabama business growth expansion",
    "Montgomery AL new companies opening",
    "Montgomery Alabama economic development news",
    "Montgomery AL commercial real estate development",
]

MONTGOMERY_COMPANIES_LINKEDIN = [
    "https://www.linkedin.com/company/hyundai-motor-manufacturing-alabama/",
    "https://www.linkedin.com/company/baptist-health-montgomery/",
    "https://www.linkedin.com/company/city-of-montgomery-alabama/",
    "https://www.linkedin.com/company/maxwell-air-force-base/",
    "https://www.linkedin.com/company/alabama-state-university/",
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
    ("https://opendata.montgomeryal.gov/", "Extract all available datasets: name, category, description, last updated date, and number of records. Focus on business licenses, permits, economic, employer, and workforce datasets."),
]
