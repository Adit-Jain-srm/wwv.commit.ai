# Data Collection Pipeline — Workforce Pulse

Collects job postings and business growth signals for the Montgomery, AL region using Bright Data.

## Setup

```bash
pip install -r requirements.txt
cp ../.env.example ../.env   # Add BRIGHTDATA_API_TOKEN
```

## Usage

```bash
python -m data_collection.pipeline                          # Run all collectors
python -m data_collection.pipeline --jobs                   # Jobs only
python -m data_collection.pipeline --business               # Business signals only
python -m data_collection.pipeline --glassdoor              # Glassdoor employer quality only
python -m data_collection.pipeline --google-maps            # Google Maps local business only
python -m data_collection.pipeline --jobs --business --glassdoor --google-maps  # Explicit all
```

## Outputs

| File | Description |
|------|-------------|
| `data/jobs_latest.json` | Enriched job postings (industry, skills) |
| `data/trends_latest.json` | Hiring trends (by industry, top roles, in-demand skills) |
| `data/business_latest.json` | Business growth signals |
| `data/glassdoor_latest.json` | Glassdoor employer reviews and ratings |
| `data/google_maps_latest.json` | Google Maps local business discovery |
| `data/pipeline_summary.json` | Run summary with counts per collector |
| `data/pipeline_progress.json` | Live progress state (polled by frontend during runs) |

## Tests

```bash
python -m pytest data_collection/tests -v
```

## Structure

- `brightdata_client.py` — Bright Data Web Unlocker / SERP API client
- `analysis.py` — Hiring trend analysis, industry/skills extraction
- `collectors/jobs.py` — Job posting collection (LinkedIn, Indeed, USAJobs, JobAps via SERP + AI extract)
- `collectors/business.py` — Business signals collection (LinkedIn companies, news, economic signals)
- `pipeline.py` — Orchestrator (writes progress to `pipeline_progress.json` for frontend polling)
