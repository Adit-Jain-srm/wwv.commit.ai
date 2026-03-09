# Workforce Pulse — Project Memory

Short reference of decisions, constraints, and goals to keep us aligned.

## Core Vision

- **Product**: Workforce Pulse — a real-time, AI-powered workforce & economic intelligence dashboard for **Montgomery, Alabama**.
- **Track**: World Wide Vibes 2026 — **Workforce, Business & Economic Growth**.
- **Audience**: Mayor, Planning Dept, Workforce Agencies, Economic Development teams.
- **Positioning**: "Montgomery's Strategic Workforce Intelligence Platform" — a **decision-support system**, not just charts.

## Problem & Approach

- Problem: Fragmented, lagging data on hiring trends, skills, and business activity; no unified view for policy and training decisions.
- Approach: Combine **Bright Data web datasets** + **Montgomery Open Data Portal** + **Azure AI** to:
  - Aggregate jobs and business signals (public, federal, private).
  - Classify by **industry** and **sector** (public/federal/private).
  - Detect **skills gaps** vs local education programs.
  - Surface **policy-ready insights** (ratios, trends, maps).

## Data & Intelligence Stack

- **Bright Data**:
  - SDK (`brightdata-sdk`) used in `data_collection/brightdata_client.py`.
  - Datasets: LinkedIn jobs/companies, Indeed jobs, Crunchbase companies, Zillow properties, Google Maps reviews, Glassdoor jobs/reviews.
  - Web Unlocker + AI `extract` for arbitrary pages.
  - SERP API for search-based discovery.
- **Montgomery Open Data Portal**:
  - Scraped + (later) API integration.
  - Focus datasets: business licenses, permits, economic indicators, zoning/land use, workforce & public safety.
- **Analysis Engine** (`data_collection/analysis.py`):
  - Montgomery-aligned industries (10): government, defense_federal, public_safety, healthcare, manufacturing, technology, education, retail_hospitality, transportation, construction_trades.
  - Sector tagging: `public` / `federal` / `private` (federal wins over public; no bare "public" substring).
  - Skills extraction with compiled regex patterns + synonym mapping for gap detection.
  - Outputs: `trends_latest.json` with `by_industry`, `by_sector`, `public_sector_ratio`, `top_roles`, `top_companies`, `in_demand_skills`, `skills_gap`, `by_source`.
- **4 Data Collectors** (`data_collection/collectors/`):
  - `jobs_collector.py` — LinkedIn SDK jobs, Indeed scraping, USAJobs, city portals.
  - `business_collector.py` — Business filings, economic signals, defense contracts, commercial real estate.
  - `glassdoor_collector.py` — Employer ratings, reviews, salary data via Bright Data.
  - `google_maps_collector.py` — Local business discovery, reviews via Bright Data.

## AI Layer (Azure OpenAI)

- Env vars (in `.env` / `.env.example`):
  - `AZURE_OPENAI_ENDPOINT`
  - `AZURE_OPENAI_API_KEY`
  - `AZURE_OPENAI_DEPLOYMENT` (gpt-4o)
  - `AZURE_OPENAI_API_VERSION` (2025-01-01-preview)
- **Centralized `_call_azure()` helper** in `backend/azure_ai.py`:
  - Retry logic: 2 retries, 1.5s delay, retries on HTTP 429 and 5xx.
  - `_safe_parse_json()` helper for robust JSON extraction from markdown code blocks.
  - Montgomery-specific context injected into all prompts.
- **Implemented AI features**:
  - `generate_insights()` — AI-generated insight bullets from workforce data.
  - `generate_policy_brief()` — Executive policy brief (summary, key findings, recommended actions).
  - `ask_workforce_pulse()` — Natural-language Q&A grounded in real workforce data.
  - `run_scenario()` — Scenario simulation with projected impact (e.g., "What if a data center opens?").

## Application Architecture

- **Backend** — FastAPI app in `backend/`:
  - **14 REST endpoints** with Pydantic validation, in-memory caching (30s TTL), structured logging.
  - Endpoints:
    - `GET /api/jobs` — Jobs + dashboard summary + timeseries
    - `GET /api/industries` — Industry breakdown
    - `GET /api/skills` — In-demand skills + skills gap analysis
    - `GET /api/economic-signals` — Business growth signals
    - `GET /api/employer-quality` — Glassdoor ratings + Google Maps data
    - `GET /api/neighborhoods` — Neighborhood-level workforce aggregation
    - `GET /api/insights` — AI-generated insight bullets
    - `GET /api/policy-brief` — Executive policy brief
    - `GET /api/pipeline-status` — Last pipeline run summary (4 source counts)
    - `GET /api/pipeline-progress` — Live progress with per-stage item counts
    - `POST /api/run-pipeline` — Trigger data collection pipeline
    - `POST /api/ask` — Natural-language workforce Q&A (Pydantic-validated)
    - `POST /api/scenario` — Scenario simulation (Pydantic-validated)
    - `GET /health` — Health check
  - Reads from `data_collection/data/*.json`; AI endpoints call Azure OpenAI.

- **Frontend** — Next.js 16.1.6 (App Router) + Turbopack:
  - **Stack**: React 18 + TailwindCSS + ShadCN-style primitives + Recharts + Leaflet (`react-leaflet`).
  - **Theme**: dark-mode default; Bloomberg/Stripe-style density; Inter via `next/font`.
  - **9 pages**: `/` (dashboard), `/map`, `/hiring`, `/skills`, `/signals`, `/training`, `/insights`, `/scenarios`, `/employer-quality`.
  - **Layout**:
    - TopNav: logo, Montgomery region, **Intelligence Search** (filters across pages), export-to-PDF.
    - SidebarNav: Link-based navigation with `aria-current="page"` and accessible icons.
  - **Dashboard sections (homepage)**:
    - Hero + KPI row (Workforce Gap Score, Job growth velocity, Public/private ratio, Top industry, New businesses).
    - Hiring Trends: multi-line chart with gradient fills, legend toggles, **Demo Mode** projections.
    - Workforce Intelligence Map: centerpiece with layer toggles, CARTO dark tiles.
    - Skills Demand | Economic Signals: side-by-side.
    - Industry Breakdown | AI sidebar (AskWorkforcePulse, Scenario Simulator, insights).
    - Training Alignment + Key education partners.
  - **Standalone pages**:
    - `/map`: Workforce Intelligence Map (command-center style).
    - `/hiring`: Hiring Trends + Industry Breakdown.
    - `/skills`: Computed Workforce Gap Score + Skills Demand Clusters (Technology/Healthcare/Defense).
    - `/signals`: Economic Activity Timeline (scrollable event feed).
    - `/insights`: **Executive Policy Brief** (synthesized, non-redundant) + Export PDF.
    - `/scenarios`: Scenario Simulation + Demo Mode "Simulate Future Growth" button.
    - `/employer-quality`: Glassdoor employer ratings + Google Maps local business data.
  - **Features**:
    - Intelligence Search: query filters/highlights charts (hiring industry, skills, map).
    - Demo Mode: 6-month projection overlays on Hiring, Industry, Skills.
    - Policy Brief: `/api/policy-brief` → Executive Summary, Key Findings, Recommended Actions.
    - Empty states: "No data — run the pipeline" messages when data is loaded but empty.
    - Error boundary: React error boundary catches render crashes with retry button.
    - Pipeline progress: progress bar + per-stage breakdown with checkmarks and item counts.
  - **Backend integration**: Uses `NEXT_PUBLIC_API_BASE_URL` when set.

- **Dependency Management**:
  - Central Python requirements in `requirements.txt` at the project root.
  - `data_collection/requirements.txt` reuses the root file via `-r ../requirements.txt`.
  - Frontend: use **`npm ci`** (not `npm install`) to preserve lockfile integrity.
  - `@next/swc-win32-x64-msvc` listed as explicit `optionalDependency` in `package.json` to prevent npm from stripping it.
  - `turbopack.root` set in `next.config.mjs` to fix workspace detection when parent directories contain lockfiles.

- **Deployment**:
  - Frontend: **Vercel**.
  - Backend: **Azure App Service / Container Apps**.
  - CI: GitHub Actions for tests + (optional) scheduled data collection.

## Non-Goals (for hackathon scope)

- Not building a full production ETL/warehouse; JSON + simple storage is acceptable.
- No full authentication/authorization system beyond a simple demo user.
- No custom ML models beyond Azure OpenAI; focus is on integration + UX.

## Required Environment Variables

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
- **Frontend**:
  - `NEXT_PUBLIC_API_BASE_URL` (FastAPI endpoint, defaults to `http://localhost:8000`)

## Roadmap Status

1. **Data collection** — ✅ complete, tested (**168 tests**):
   - Bright Data SDK client, 4 collectors (jobs, business, glassdoor, google_maps), skills/sector analysis, pipeline orchestrator with progress tracking.
2. **Backend API (FastAPI)** — ✅ complete:
   - 14 REST endpoints with Pydantic validation, in-memory caching (30s TTL), structured logging.
   - AI endpoints: insights, policy briefs, Q&A, scenario simulation with retry logic.
3. **Frontend dashboard (Next.js 16)** — ✅ complete (hackathon-ready):
   - 9 pages, demo mode, pipeline progress UI, error boundaries, accessibility, memoized computations.
4. **Polish & Submission** — ⏳:
   - [ ] Deploy FastAPI backend to Azure.
   - [ ] Deploy Next.js dashboard to Vercel.
   - [ ] Record ≤5-minute demo video showing full story.
   - [ ] Finalize `HACKATHON.md` with links (prototype, video, slides, repo, docs).

## Completed Improvement Phases

- **Phase 5** — Backend refactoring: structured logging, Pydantic models, duplicate type removal, robust JSON parsing.
- **Phase 6** — Intelligence quality: compiled regex patterns, expanded skills extraction, synonym-based gap detection, division-by-zero guards.
- **Phase 7** — AI improvements: Montgomery-specific prompt context, error context in fallbacks, increased token limits.
- **Phase 8** — Frontend improvements: computed gap score, error boundary, memoization, employer-quality page, accessibility (aria attributes, keyboard nav).
- **Phase 9** — Performance: in-memory caching in `data_access.py` (30s TTL), `useMemo` for chart data transformations.
- **Phase 10** — Audit fixes: cache key mismatch, subprocess error handling, type safety, dead code removal.
- **Phase 12** — Pipeline observability: structured progress with per-stage item counts, progress bar UI.
- **Phase 13** — AI retry logic: centralized `_call_azure()` helper with retry on 429/5xx, `_safe_parse_json()`.
- **Phase 14** — Empty states: "No data — run the pipeline" messages for hiring trends and AI insights.
- **Phase 18** — Security: sanitized `.env.example`, comprehensive `.gitignore`, git history audit.

### Session 3 Fixes (Continued Conversation)

- **React Hooks violation** — `useSearch()` was called after conditional returns in `employer-quality/page.tsx`. Moved all hooks above early returns.
- **Cluster badge overflow** — "CLUSTER" text truncation in `SkillsDemandClusters.tsx`. Shortened labels (e.g., "Gov & Admin", "Mfg & Trades"), added `shrink-0 whitespace-nowrap`, hid empty clusters with `activeClusterKeys` filter.
- **Hiring Trends chart blank** — Backend was dividing job totals over 12 weeks (producing ~1-2/sector); unmapped industries and null-industry jobs were dropped. Fixed industry mapping for `construction_trades`, `retail_hospitality`, `transportation`; distributed null-industry jobs proportionally across sectors.
- **Chart rendering** — `<Area>` components wrapped in `<g>` elements were invisible to Recharts (requires direct children of `<AreaChart>`). Replaced `.map()` returning `<g>` wrappers with `.flatMap()` returning `<Area>` elements directly. Added `shortDate()` formatter, stacked areas with `stackId`, increased fill opacity.
- **X-axis label overflow** — Fixed chart margins and added `interval="preserveStartEnd"` to XAxis.
- **Skills Gap empty clusters** — Filtered out clusters with no skills data via `activeClusterKeys` useMemo.
- **PDF report improvements** (multiple rounds):
  - Raw snake_case keys → display labels via `_industryLabelMap`.
  - Emoji (✅❌⚠) → ASCII-safe markers (`[ALIGNED]`, `[GAP - no local training]`, etc.) for PDF rendering.
  - Synthesized consulting-quality insights from actual data instead of raw data sentences.
  - Replaced forced page breaks per section with continuous flow using `startSection()` helper.
  - Fixed double page numbering on chart pages via `pageNumbered` flag.
- **Fake growth metric** — Synthetic timeseries always showed positive growth due to monotonic curve. Initially replaced with sine-wave oscillation; ultimately **removed synthetic timeseries entirely**. Backend now returns only real data points (one per collection date). Frontend falls back to honest horizontal bar chart ("Sector Hiring Snapshot") when only 1 data point exists. Growth metric shows "—" instead of fabricated percentage.
- **Dynamic metric labels** — `jobGrowthLabel` in DashboardShell now dynamically shows "vs last 30/90 days" or "vs last 12 months" based on actual data source.

## Key Design Decisions

- **No synthetic data**: Timeseries chart only shows real observed data points. The single-point fallback renders a horizontal bar chart of actual sector counts with a message to run additional pipeline cycles for trend analysis.
- **Proportional distribution**: Jobs with `null` industry are distributed proportionally across classified sectors in the timeseries buckets (not dropped or lumped into "other").
- **Industry consolidation**: 10 raw industries map to 7 chart series: `construction_trades` and `transportation` → `manufacturing`; `retail_hospitality` → `government`.
