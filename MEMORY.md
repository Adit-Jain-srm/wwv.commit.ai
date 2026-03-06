# Workforce Pulse — Project Memory

Short reference of decisions, constraints, and goals to keep us aligned.

## Core Vision

- **Product**: Workforce Pulse — a real‑time, AI‑powered workforce & economic intelligence dashboard for **Montgomery, Alabama**.
- **Track**: World Wide Vibes 2026 — **Workforce, Business & Economic Growth**.
- **Audience**: Mayor, Planning Dept, Workforce Agencies, Economic Development teams.
- **Positioning**: “Montgomery’s Strategic Workforce Intelligence Platform” — a **decision‑support system**, not just charts.

## Problem & Approach

- Problem: Fragmented, lagging data on hiring trends, skills, and business activity; no unified view for policy and training decisions.
- Approach: Combine **Bright Data web datasets** + **Montgomery Open Data Portal** + **Azure AI** to:
  - Aggregate jobs and business signals (public, federal, private).
  - Classify by **industry** and **sector** (public/federal/private).
  - Detect **skills gaps** vs local education programs.
  - Surface **policy‑ready insights** (ratios, trends, maps).

## Data & Intelligence Stack

- **Bright Data**:
  - SDK (`brightdata-sdk`) used in `data_collection/brightdata_client.py`.
  - Datasets: LinkedIn jobs/companies, Indeed jobs, Crunchbase companies, Zillow properties, Google Maps reviews, Glassdoor jobs/reviews.
  - Web Unlocker + AI `extract` for arbitrary pages.
- **Montgomery Open Data Portal**:
  - Scraped + (later) API integration.
  - Focus datasets: business licenses, permits, economic indicators, zoning/land use, workforce & public safety.
- **Analysis Engine** (`data_collection/analysis.py`):
  - Montgomery‑aligned industries: government, defense_federal, public_safety, healthcare, manufacturing, technology, education, retail_hospitality, transportation, construction_trades.
  - Sector tagging: `public` / `federal` / `private` (federal wins over public; no bare “public” substring).
  - Skills extraction + **skills‑gap detection** vs `LOCAL_DEGREE_FIELDS`.
  - Outputs: `trends_latest.json` with `by_industry`, `by_sector`, `public_sector_ratio`, `top_roles`, `top_companies`, `in_demand_skills`, `skills_gap`, `by_source`.

## AI Layer (Azure OpenAI)

- Env vars (in `.env` / `.env.example`):
  - `AZURE_OPENAI_ENDPOINT`
  - `AZURE_OPENAI_API_KEY`
  - `AZURE_OPENAI_DEPLOYMENT` (gpt‑4o)
  - `AZURE_OPENAI_API_VERSION` (2025‑01‑01-preview)
- Intended uses:
  - Summarize trends into human‑readable **AI Insight Panel** text.
  - Scenario sims / “digital twin” style what‑ifs (e.g. new data center, hiring surge).
  - Natural‑language query interface later if time allows.

## Application Architecture

- **Backend** — ✅ FastAPI app in `backend/`:
  - Endpoints: `/api/jobs`, `/api/industries`, `/api/skills`, `/api/economic-signals`, `/api/neighborhoods`, `/api/insights`, `/api/policy-brief`, `/api/pipeline-status`, `/api/run-pipeline`, `/api/ask`, `/api/scenario`.
  - Reads from `data_collection/data/*.json`; AI endpoints call Azure OpenAI.

- **Frontend**:
  - **Next.js 14 (App Router)** + React.
  - **TailwindCSS + ShadCN UI**.
  - **Recharts** for charts.
  - **Leaflet** (`react-leaflet`) + CARTO dark tiles for Workforce Intelligence Map.
  - Dark‑mode, data‑dense dashboard (Bloomberg/Stripe aesthetic).

- **Dependency Management**:
  - Central Python requirements in `requirements.txt` at the project root.
  - `data_collection/requirements.txt` simply reuses the root file via `-r ../requirements.txt` so backend + collectors stay in sync.

- **Deployment**:
  - Frontend: **Vercel**.
  - Backend: **Azure App Service / Container Apps**.
  - CI: GitHub Actions for tests + (optional) scheduled data collection.

## Non‑Goals (for hackathon scope)

- Not building a full production ETL/warehouse; JSON + simple storage is acceptable.
- No full authentication/authorization system beyond a simple demo user.
- No custom ML models beyond Azure OpenAI; focus is on integration + UX.

## Required / Planned Environment Variables

- **Bright Data**:
  - `BRIGHTDATA_API_TOKEN`
  - `BRIGHTDATA_UNLOCKER_ZONE`
  - `BRIGHTDATA_SERP_ZONE`
  - `BRIGHTDATA_DC_HOST`, `BRIGHTDATA_DC_PORT`, `BRIGHTDATA_DC_USER`, `BRIGHTDATA_DC_PASS`
- **Azure OpenAI**:
  - `AZURE_OPENAI_ENDPOINT`
  - `AZURE_OPENAI_API_KEY`
  - `AZURE_OPENAI_DEPLOYMENT`
  - `AZURE_OPENAI_API_VERSION`
- **Frontend / Maps (to add later)**:
  - `NEXT_PUBLIC_API_BASE_URL` (FastAPI endpoint)
  - `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` (if using Mapbox) _or_ public tile URL config for Leaflet/OSM.

## High‑Level Roadmap (Hackathon)

1. **Data collection (core)** — ✅ complete, tested (33 tests):
   - Bright Data SDK client, collectors for jobs + business signals, skills/sector analysis.
2. **Backend API (FastAPI)** — ✅ complete:
   - `backend/` FastAPI app with endpoints:
     - `GET /api/jobs`, `GET /api/industries`, `GET /api/skills`, `GET /api/economic-signals`, `GET /api/neighborhoods`
     - `GET /api/insights` (Azure OpenAI)
     - `GET /api/policy-brief` (structured executive brief with recommendations)
     - `GET /api/pipeline-status`, `POST /api/run-pipeline`
     - `POST /api/ask`, `POST /api/scenario`
3. **Frontend dashboard (Next.js App Router)** — ✅ implemented (hackathon-ready):
  - **Location**: `frontend/`
  - **Stack**: Next.js App Router + React + TailwindCSS + ShadCN-style primitives + Recharts + Leaflet (`react-leaflet`)
  - **Theme**: dark-mode default; Bloomberg/Stripe-style density; Inter via `next/font`
  - **Multi-page routing**: `/` (dashboard), `/map`, `/hiring`, `/skills`, `/signals`, `/training`, `/insights`, `/scenarios`
  - **Layout**:
    - ✅ TopNav: logo, Montgomery region, **Intelligence Search** (filters across pages), export-to-PDF
    - ✅ SidebarNav: Link-based navigation to all pages
  - **Dashboard sections (homepage)**:
    - ✅ Hero + KPI row (Workforce Gap Score, Job growth velocity, Public/private ratio, Top industry, New businesses)
    - ✅ Hiring Trends: multi-line chart with gradient fills, legend toggles, **Demo Mode** projections
    - ✅ Workforce Intelligence Map: centerpiece with layer toggles, dark theme
    - ✅ Skills Demand | Economic Signals: side-by-side
    - ✅ Industry Breakdown | AI sidebar (AskWorkforcePulse, Scenario Simulator, insights)
    - ✅ Training Alignment + Key education partners
  - **Standalone pages**:
    - `/map`: Workforce Intelligence Map (command-center style)
    - `/hiring`: Hiring Trends + Industry Breakdown
    - `/skills`: Workforce Gap Score card + Skills Demand Clusters (Technology/Healthcare/Defense)
    - `/signals`: Economic Activity Timeline (scrollable event feed)
    - `/insights`: **Executive Policy Brief** (synthesized, non-redundant) + Export PDF
    - `/scenarios`: Scenario Simulation + Demo Mode “Simulate Future Growth” button
  - **Features**:
    - Intelligence Search: query filters/highlights charts (hiring industry, skills, map)
    - Demo Mode: 6‑month projection overlays on Hiring, Industry, Skills
    - Policy Brief: `/api/policy-brief` → Executive Summary, Key Findings, Recommended Actions
  - **Backend integration**: Uses `NEXT_PUBLIC_API_BASE_URL` when set
4. **Polish & Submission** — ⏳ later:
   - [ ] Deploy FastAPI backend to Azure.
   - [ ] Deploy Next.js dashboard to Vercel.
   - [ ] Record ≤5‑minute demo video showing full story.
   - [ ] Finalize `HACKATHON.md` with links (prototype, video, slides, repo, docs).

## Frontend TODO (remaining polish)

- ✅ Metric sparklines in KPI cards
- ✅ Filters: industry, sector, date range; Intelligence Search drives chart highlighting
- ✅ Print/PDF: nav hidden in print; policy brief has dedicated Export PDF
- [ ] (Optional) Deploy to Vercel; record ≤5‑minute demo video


