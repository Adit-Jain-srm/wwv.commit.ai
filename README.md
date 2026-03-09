# Workforce Pulse

**Real-time AI-powered workforce & economic intelligence dashboard for Montgomery, AL.**

Built for the [World Wide Vibes Hackathon 2026](https://genai.works) | Track: **Workforce, Business & Economic Growth** | Team: **wwv.commit.ai**

---

## Problem

Local governments and workforce agencies lack a unified, real-time view of hiring trends, in-demand skills, and business growth signals. Decision-makers rely on lagging, fragmented data — making it difficult to align training programs with actual employer demand.

## Solution

**Workforce Pulse** is an AI-powered decision-support platform that:

- **Aggregates job postings** from LinkedIn, Indeed, USAJobs, and the Montgomery Open Data Portal via Bright Data into a single, live feed of regional hiring activity (public, federal, and private sectors).
- **Identifies hiring trends** by industry (government, defense, healthcare, manufacturing, tech, education, public safety) and tags each role by sector. With a single pipeline run, displays an honest sector snapshot; with multiple runs over time, builds real multi-week trend analysis.
- **Monitors business growth signals** — new business filings, defense contracts, data center projects (AWS / Google / Meta), commercial real estate activity, and open-data economic indicators.
- **Tracks employer quality** via Glassdoor ratings and Google Maps local business discovery for Montgomery's key employers.
- **Maps training needs and skills gaps** by comparing in-demand skills from job descriptions against local education programs (ASU, AUM, Trenholm State, Faulkner, Huntingdon).
- **Generates policy-ready insights** via Azure OpenAI — executive policy briefs, scenario simulations ("what if a data center opens?"), and a natural-language Q&A interface grounded in real data.

## Tech Stack

| Layer | Tools |
|---|---|
| Data Collection | **Bright Data SDK (Python)** — LinkedIn jobs/companies, Indeed, Glassdoor reviews, Google Maps, SERP API, Web Unlocker with AI extract; **Montgomery Open Data Portal**; 4 async collectors in `data_collection/` |
| AI / Analysis | **Azure OpenAI (GPT-4o)** for insights, policy briefs, Q&A, and scenario simulation with retry logic; Python analysis engine with compiled regex, skills-gap detection with synonym mapping, Montgomery-aligned industry classification (10 industries) |
| Backend | **FastAPI** (`backend/`) — 14 REST endpoints with Pydantic validation, in-memory caching (30s TTL), structured logging; reads pipeline JSON, calls Azure OpenAI |
| Frontend | **Next.js 16 (App Router)** + React 18, Tailwind CSS, ShadCN-style components, Recharts, Leaflet; 9 pages, demo mode with 6-month projections, PDF export, progress bar with per-stage tracking, error boundaries, keyboard-accessible navigation |
| Testing | **168 tests** (pytest + pytest-asyncio) covering API endpoints, data access, analysis, and edge cases |

## Architecture

```
data_collection/          # Bright Data collectors + analysis engine
  collectors/             # jobs, business, glassdoor, google_maps
  analysis.py             # Industry classification, skills extraction, gap detection
  pipeline.py             # Orchestrator with live progress tracking
  config.py               # Montgomery-specific search queries + targets

backend/                  # FastAPI API server
  main.py                 # 14 endpoints (jobs, industries, skills, signals, insights, etc.)
  azure_ai.py             # Azure OpenAI integration with retry logic
  data_access.py          # Cached JSON data access layer

frontend/                 # Next.js dashboard
  app/(dashboard)/        # 9 pages: dashboard, map, hiring, skills, signals, etc.
  components/             # Charts, dashboard shell, layout, UI primitives
  lib/                    # Data context, demo mode context
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/jobs` | Jobs + dashboard summary + timeseries (real data only, no synthetic fill) |
| GET | `/api/industries` | Industry breakdown |
| GET | `/api/skills` | In-demand skills + skills gap analysis |
| GET | `/api/economic-signals` | Business growth signals |
| GET | `/api/employer-quality` | Glassdoor ratings + Google Maps data |
| GET | `/api/neighborhoods` | Neighborhood-level workforce aggregation |
| GET | `/api/insights` | AI-generated insight bullets |
| GET | `/api/policy-brief` | Executive policy brief (summary, findings, actions) |
| GET | `/api/pipeline-status` | Last pipeline run summary (4 source counts) |
| GET | `/api/pipeline-progress` | Live progress with per-stage item counts |
| POST | `/api/run-pipeline` | Trigger data collection pipeline |
| POST | `/api/ask` | Natural-language workforce Q&A |
| POST | `/api/scenario` | Scenario simulation (projected impact) |

## Running Locally

### Prerequisites

- Python 3.11+ with `uv` (or pip)
- Node.js 18+
- `.env` file (copy from `.env.example` and fill in API keys)

### Backend

```bash
# From project root
pip install -r requirements.txt   # or: uv pip install -r requirements.txt
uv run uvicorn backend.main:app --reload
```

API at `http://localhost:8000`.

### Data Pipeline

```bash
# Run all collectors (requires Bright Data API token)
python -m data_collection.pipeline

# Or run specific collectors
python -m data_collection.pipeline --jobs --business --glassdoor --google-maps
```

### Frontend

```bash
cd frontend
npm ci        # Use npm ci (not npm install) to preserve lockfile
npm run dev
```

Dashboard at `http://localhost:3000`. Set `NEXT_PUBLIC_API_BASE_URL` in `frontend/.env` if the API is on a different host.

### Tests

```bash
python -m pytest  # 168 tests
```

## Team

| Name | Email | GitHub | LinkedIn |
|---|---|---|---|
| Adit Jain | aditjain2005@gmail.com | [@Adit-Jain-srm](https://github.com/Adit-Jain-srm) | [LinkedIn](https://www.linkedin.com/in/-adit-jain) |
| Amina Yekhlef | ayekhlef1@gmail.com | -- | [LinkedIn](http://www.linkedin.com/in/ayekhlef) |
| Daria Dackiewicz | dackiewiczd@outlook.com | [@daria-dot](https://github.com/daria-dot) | [LinkedIn](https://linkedin.com/in/daria-dackiewicz-85616a2a2) |
| Ridhima Kathait | ridhima.kathait@gmail.com | [@Ridhimakathait](https://github.com/Ridhimakathait) | [LinkedIn](https://www.linkedin.com/in/ridhima-kathait-3229561a0/) |
