# Data Collection Pipeline — Workforce Pulse

Collects job postings and business growth signals for the Montgomery, AL region using Bright Data.

## Setup

```bash
pip install -r requirements.txt
cp ../.env.example ../.env   # Add BRIGHTDATA_API_TOKEN
```

## Usage

```bash
python -m data_collection.pipeline              # Run all collectors
python -m data_collection.pipeline --jobs       # Jobs only
python -m data_collection.pipeline --business   # Business signals only
```

## Outputs

| File | Description |
|------|-------------|
| `data/jobs_latest.json` | Enriched job postings (industry, skills) |
| `data/trends_latest.json` | Hiring trends (by industry, top roles, in-demand skills) |
| `data/business_latest.json` | Business growth signals |
| `data/pipeline_summary.json` | Run summary |

## Tests

```bash
python -m pytest data_collection/tests -v
```

## Structure

- `brightdata_client.py` — Bright Data Web Unlocker / SERP API client
- `analysis.py` — Hiring trend analysis, industry/skills extraction
- `collectors/jobs.py` — Job posting collection
- `collectors/business.py` — Business signals collection
- `pipeline.py` — Orchestrator
