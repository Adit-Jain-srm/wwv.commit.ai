"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export type JobsSummary = {
  total_active_postings: number;
  public_ratio: number;
  private_ratio: number;
  top_growing_industry: string;
  new_businesses_this_month: number;
  last_updated: string;
};

export type HiringTimeseriesPoint = {
  date: string;
  government: number;
  defense: number;
  healthcare: number;
  manufacturing: number;
  technology: number;
  education: number;
  public_safety: number;
};

export type JobsApiResponse = {
  jobs: any[];
  summary: JobsSummary;
  timeseries: HiringTimeseriesPoint[];
};

export type IndustriesApiResponse = {
  by_industry: Record<string, number>;
  top_industries: string[];
};

export type SkillsApiResponse = {
  in_demand_skills_list: string[];
  skills_gap_list: {
    skill: string;
    local_training_available: boolean;
    gap: boolean;
  }[];
};

export type EconomicSignal = {
  id: string;
  label: string;
  value: number;
  unit: string;
  delta_30d: number;
  trend: "up" | "down" | "flat";
  signal_type?: string;
};

export type EconomicSignalsApiResponse = {
  signals: EconomicSignal[];
};

export type NeighborhoodApiResponse = {
  neighborhoods: {
    name: string;
    job_density_score: number;
    top_sector: string;
  }[];
};

export type DashboardData = {
  jobs: JobsApiResponse | null;
  industries: IndustriesApiResponse | null;
  skills: SkillsApiResponse | null;
  signals: EconomicSignalsApiResponse | null;
  neighborhoods: NeighborhoodApiResponse | null;
  insights: string[] | null;
  pipelineStatus: {
    last_run: string | null;
    region: string | null;
    jobs_count: number;
    business_signals_count: number;
  } | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

const DashboardDataContext = createContext<DashboardData | null>(null);

export function DashboardDataProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<JobsApiResponse | null>(null);
  const [industries, setIndustries] = useState<IndustriesApiResponse | null>(null);
  const [skills, setSkills] = useState<SkillsApiResponse | null>(null);
  const [signals, setSignals] = useState<EconomicSignalsApiResponse | null>(null);
  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodApiResponse | null>(null);
  const [insights, setInsights] = useState<string[] | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState<DashboardData["pipelineStatus"]>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = async () => {
    try {
      setLoading(true);
      setError(null);
      const [jobsRes, industriesRes, skillsRes, signalsRes, neighborhoodsRes, insightsRes, pipelineRes] =
        await Promise.all([
          fetch(`${API_BASE}/api/jobs`),
          fetch(`${API_BASE}/api/industries`),
          fetch(`${API_BASE}/api/skills`),
          fetch(`${API_BASE}/api/economic-signals`),
          fetch(`${API_BASE}/api/neighborhoods`),
          fetch(`${API_BASE}/api/insights`),
          fetch(`${API_BASE}/api/pipeline-status`),
        ]);

      const [jobsData, industriesData, skillsData, signalsData, neighborhoodsData, insightsData, pipelineData] =
        await Promise.all([
          jobsRes.json().catch(() => null),
          industriesRes.json().catch(() => null),
          skillsRes.json().catch(() => null),
          signalsRes.json().catch(() => null),
          neighborhoodsRes.json().catch(() => null),
          insightsRes.json().catch(() => null),
          pipelineRes.json().catch(() => null),
        ]);

      setJobs(jobsData);
      setIndustries(industriesData);
      setSkills(skillsData);
      setSignals(signalsData);
      setNeighborhoods(neighborhoodsData);
      setInsights(insightsData?.insights ?? insightsData ?? null);
      setPipelineStatus(pipelineData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const value = useMemo<DashboardData>(
    () => ({
      jobs,
      industries,
      skills,
      signals,
      neighborhoods,
      insights,
      pipelineStatus,
      loading,
      error,
      refetch: loadAll,
    }),
    [jobs, industries, skills, signals, neighborhoods, insights, pipelineStatus, loading, error]
  );

  return (
    <DashboardDataContext.Provider value={value}>
      {children}
    </DashboardDataContext.Provider>
  );
}

export function useDashboardData() {
  const ctx = useContext(DashboardDataContext);
  if (!ctx) throw new Error("useDashboardData must be used within DashboardDataProvider");
  return ctx;
}
