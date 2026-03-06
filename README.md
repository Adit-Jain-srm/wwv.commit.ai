# Workforce Pulse

**Real-time dashboards for job market intelligence and economic growth monitoring in Montgomery, AL.**

Built for the [World Wide Vibes Hackathon 2026](https://genai.works) | Track: **Workforce, Business & Economic Growth** | Team: **wwv.commit.ai**

---

## Problem

Local governments and workforce agencies lack a unified, real-time view of hiring trends, in-demand skills, and business growth signals. Decision-makers rely on lagging, fragmented data — making it difficult to align training programs with actual employer demand.

## Solution

**Workforce Pulse** is an AI-powered dashboard platform that:

- **Aggregates job postings** from Bright Data and the Montgomery Open Data Portal into a single, live feed of regional hiring activity (public, federal, and private sectors).
- **Identifies hiring trends** by industry (government, defense, healthcare, manufacturing, tech, education, public safety) and tags each role by sector (public / federal / private).
- **Monitors business growth signals** such as new business filings, defense contracts, data center projects (AWS / Google / Meta), commercial real estate activity, and open‑data economic indicators.
- **Maps training needs and skills gaps** by comparing in‑demand skills from job descriptions against local education programs (ASU, AUM, Trenholm, etc.).
- **Generates policy‑ready insights** for the Mayor, Planning Department, and workforce agencies: public‑sector hiring velocity, public vs. private ratios, neighborhood‑level workforce deserts, and data‑center impact signals.

## Tech Stack

| Layer | Tools |
|---|---|
| Data Collection | **Bright Data SDK (Python)** for LinkedIn / Indeed / Crunchbase / Zillow / Google Maps datasets and web search; **Montgomery Open Data Portal (GIS / Esri)**; custom Python collectors in `data_collection/` |
| AI / Analysis | **Azure AI / Azure AI Foundry (OpenAI / models-as-a-service)** for extraction, summarization, and scenario simulation; Python (pandas, async pipeline, custom trend engine in `analysis.py`) |
| Backend | **Python (FastAPI)** service (`backend/`) that reads pipeline outputs from `data_collection/data/*.json`, exposes REST/JSON endpoints (`/api/jobs`, `/api/industries`, `/api/skills`, `/api/economic-signals`, `/api/neighborhoods`, `/api/insights`), and optionally calls Azure OpenAI for narrative insights |
| Frontend / Dashboard | **Node.js + Next.js/React** app in `frontend/` using the App Router, Tailwind CSS, ShadCN-style components, Recharts, and Leaflet for Montgomery-focused analytics dashboards |
| Deployment | **Vercel** for the Next.js dashboard; **Azure App Service / Container Apps** for the Python API and scheduled pipeline runs; GitHub Actions for tests and pipeline triggers |
| Observability & Storage | JSON data lake in `data_collection/data/` (hackathon scope), pluggable to Azure Blob / Postgres later; logging via Python `logging` and Vercel / Azure logs |

## Running locally

1. **Backend (required for live dashboard data)** — from project root:
   ```bash
   uv run uvicorn backend.main:app --reload
   ```
   API runs at `http://localhost:8000`. It serves data from `data_collection/data/*.json` (run the pipeline to populate).

2. **Frontend** — from project root:
   ```bash
   cd frontend && npm run dev
   ```
   Dashboard at `http://localhost:3000`. Set `NEXT_PUBLIC_API_BASE_URL` in `frontend/.env` if the API is on a different URL.

## Team

| Name | Email | GitHub | LinkedIn |
|---|---|---|---|
| Adit Jain | aditjain2005@gmail.com | [@Adit-Jain-srm](https://github.com/Adit-Jain-srm) | [LinkedIn](https://www.linkedin.com/in/-adit-jain) |
| Amina Yekhlef | ayekhlef1@gmail.com | — | [LinkedIn](http://www.linkedin.com/in/ayekhlef) |
| Daria Dackiewicz | dackiewiczd@outlook.com | [@daria-dot](https://github.com/daria-dot) | [LinkedIn](https://linkedin.com/in/daria-dackiewicz-85616a2a2) |
| Ridhima Kathait | ridhima.kathait@gmail.com | [@Ridhimakathait](https://github.com/Ridhimakathait) | [LinkedIn](https://www.linkedin.com/in/ridhima-kathait-3229561a0/) |

