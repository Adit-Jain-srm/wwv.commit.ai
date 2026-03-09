"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  Activity,
  Building2,
  ChevronDown,
  ChevronRight,
  Database,
  FileText,
  Factory,
  MapPin,
  Radar,
  ShieldCheck,
  TrendingUp,
  Users
} from "lucide-react";
import {
  LineChart,
  Line,
  ResponsiveContainer
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Skeleton } from "../ui/skeleton";
import { AnimatedNumber } from "../ui/animated-number";
import { useDemoMode } from "../../lib/DemoModeContext";
import { DashboardFilters } from "./DashboardFilters";
import { AskWorkforcePulse } from "./AskWorkforcePulse";
import { ScenarioSimulator } from "./ScenarioSimulator";
import { DataCenterImpactCard } from "./DataCenterImpactCard";
import {
  type Job,
  type JobsSummary,
  type JobsApiResponse,
  type IndustriesApiResponse,
  type SkillsApiResponse,
  type EconomicSignal,
  type EconomicSignalsApiResponse,
  type NeighborhoodApiResponse,
} from "../../lib/DashboardDataContext";
import {
  HiringTrendsChart,
  type HiringTimeseriesPoint
} from "../charts/HiringTrendsChart";
import {
  IndustryBreakdownChart,
  type IndustryBarDatum
} from "../charts/IndustryBreakdownChart";
import {
  SkillsDemandChart,
  type SkillDemandDatum
} from "../charts/SkillsDemandChart";
import {
  TrainingAlignmentChart,
  type TrainingAlignmentDatum
} from "../charts/TrainingAlignmentChart";
import { ErrorBoundary } from "../ui/error-boundary";
import { Button } from "../ui/button";
import { NEIGHBORHOOD_COORDS } from "../../lib/montgomery-geo";

const WorkforceMap = dynamic(
  () => import("../maps/WorkforceMap").then((m) => m.WorkforceMap),
  {
    ssr: false,
    loading: () => (
      <Card className="h-[400px]">
        <CardHeader>
          <CardTitle className="text-slate-100">
            Geographic workforce map — Montgomery neighborhoods
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[340px] w-full rounded-xl bg-slate-900/80" />
        </CardContent>
      </Card>
    )
  }
);

type InsightResponse = {
  insights: string[];
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export function DashboardShell() {
  const [jobs, setJobs] = useState<JobsApiResponse | null>(null);
  const [industries, setIndustries] =
    useState<IndustriesApiResponse | null>(null);
  const [skills, setSkills] = useState<SkillsApiResponse | null>(null);
  const [signals, setSignals] =
    useState<EconomicSignalsApiResponse | null>(null);
  const [neighborhoods, setNeighborhoods] =
    useState<NeighborhoodApiResponse | null>(null);
  const [insights, setInsights] = useState<string[] | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState<{
    last_run: string | null;
    region: string | null;
    jobs_count: number;
    business_signals_count: number;
    glassdoor_count: number;
    google_maps_count: number;
  } | null>(null);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineCurrentStep, setPipelineCurrentStep] = useState("");
  const [pipelineProgress, setPipelineProgress] = useState(0);
  const [pipelineStages, setPipelineStages] = useState<
    { name: string; status: string; items: number }[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [industryFilter, setIndustryFilter] =
    useState<string | "all">("all");
  const [sectorFilter, setSectorFilter] =
    useState<string | "all">("all");
  const [dateRange, setDateRange] =
    useState<"30d" | "90d" | "12m">("90d");
  const [exportingPdf, setExportingPdf] = useState(false);
  const demo = useDemoMode();

  useEffect(() => {
    async function loadAll() {
      try {
        setLoading(true);
        setError(null);
        const [
          jobsRes,
          industriesRes,
          skillsRes,
          signalsRes,
          neighborhoodsRes,
          insightsRes,
          pipelineStatusRes
        ] = await Promise.all([
          fetch(`${API_BASE}/api/jobs`),
          fetch(`${API_BASE}/api/industries`),
          fetch(`${API_BASE}/api/skills`),
          fetch(`${API_BASE}/api/economic-signals`),
          fetch(`${API_BASE}/api/neighborhoods`),
          fetch(`${API_BASE}/api/insights`),
          fetch(`${API_BASE}/api/pipeline-status`)
        ]);

        // Core endpoints must succeed for the dashboard to be useful
        const coreOk =
          jobsRes.ok &&
          industriesRes.ok &&
          skillsRes.ok &&
          signalsRes.ok &&
          neighborhoodsRes.ok;
        if (!coreOk) {
          throw new Error("Failed to load dashboard data");
        }

        const jobsData = (await jobsRes.json()) as JobsApiResponse;
        const industriesData = (await industriesRes.json()) as IndustriesApiResponse;
        const skillsData = (await skillsRes.json()) as SkillsApiResponse;
        const signalsData = (await signalsRes.json()) as EconomicSignalsApiResponse;
        const neighborhoodsData = (await neighborhoodsRes.json()) as NeighborhoodApiResponse;

        setJobs(jobsData);
        setIndustries(industriesData);
        setSkills(skillsData);
        setSignals(signalsData);
        setNeighborhoods(neighborhoodsData);

        // Insights can be 503 when no pipeline data — show empty and let UI prompt to run pipeline
        if (insightsRes.ok) {
          const insightsData = (await insightsRes.json()) as InsightResponse;
          setInsights(insightsData.insights ?? []);
        } else {
          setInsights([]);
        }

        // Pipeline status is optional
        if (pipelineStatusRes.ok) {
          const pipelineData = (await pipelineStatusRes.json()) as {
            last_run: string | null;
            region: string | null;
            jobs_count: number;
            business_signals_count: number;
            glassdoor_count: number;
            google_maps_count: number;
          };
          setPipelineStatus(pipelineData);
        } else {
          setPipelineStatus(null);
        }
      } catch (_err) {
        const isNetworkError =
          _err instanceof TypeError ||
          (typeof (_err as Error)?.message === "string" &&
            ((_err as Error).message.includes("fetch") ||
              (_err as Error).message.includes("Network")));
        const message = isNetworkError
          ? `Backend unreachable at ${API_BASE}. Start the API from project root: \`uv run uvicorn backend.main:app --reload\``
          : "Unable to load live data from backend API.";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    void loadAll();
  }, []);

  useEffect(() => {
    if (!pipelineRunning) return;
    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/pipeline-progress`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          running: boolean;
          progress: number;
          current_step: string;
          steps_done: string[];
          stages: { name: string; status: string; items: number }[];
        };
        setPipelineCurrentStep(data.current_step ?? "");
        setPipelineProgress(data.progress ?? 0);
        setPipelineStages(data.stages ?? []);
        if (!data.running || data.progress >= 100) {
          setPipelineRunning(false);
          // Refresh dashboard data
          const [jobsRes, industriesRes, skillsRes, signalsRes, neighborhoodsRes, insightsRes, pipelineStatusRes] =
            await Promise.all([
              fetch(`${API_BASE}/api/jobs`),
              fetch(`${API_BASE}/api/industries`),
              fetch(`${API_BASE}/api/skills`),
              fetch(`${API_BASE}/api/economic-signals`),
              fetch(`${API_BASE}/api/neighborhoods`),
              fetch(`${API_BASE}/api/insights`),
              fetch(`${API_BASE}/api/pipeline-status`),
            ]);
          if (jobsRes.ok) setJobs((await jobsRes.json()) as JobsApiResponse);
          if (industriesRes.ok) setIndustries((await industriesRes.json()) as IndustriesApiResponse);
          if (skillsRes.ok) setSkills((await skillsRes.json()) as SkillsApiResponse);
          if (signalsRes.ok) setSignals((await signalsRes.json()) as EconomicSignalsApiResponse);
          if (neighborhoodsRes.ok) setNeighborhoods((await neighborhoodsRes.json()) as NeighborhoodApiResponse);
          if (insightsRes.ok) {
            const d = (await insightsRes.json()) as InsightResponse;
            setInsights(d.insights ?? []);
          }
          if (pipelineStatusRes.ok) {
            const d = (await pipelineStatusRes.json()) as {
              last_run: string | null;
              region: string | null;
              jobs_count: number;
              business_signals_count: number;
              glassdoor_count: number;
              google_maps_count: number;
            };
            setPipelineStatus(d);
          }
        }
      } catch {
        // ignore
      }
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [pipelineRunning]);

  const lastUpdated = jobs?.summary.last_updated ?? null;
  const allTimeseries: HiringTimeseriesPoint[] = jobs?.timeseries ?? [];

  const rangeDays = dateRange === "30d" ? 30 : dateRange === "90d" ? 90 : 365;

  const filteredTimeseries = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - rangeDays);
    return allTimeseries.filter((p) => new Date(p.date) >= cutoff);
  }, [allTimeseries, rangeDays]);

  const totalSeries = useMemo(
    () =>
      filteredTimeseries.map((p) => {
        const pt = p as unknown as Record<string, number>;
        return (
          (pt.government ?? 0) +
          (pt.defense ?? 0) +
          (pt.healthcare ?? 0) +
          (pt.manufacturing ?? 0) +
          (pt.technology ?? 0) +
          (pt.education ?? 0) +
          (pt.public_safety ?? 0) +
          (pt.other ?? 0)
        );
      }),
    [filteredTimeseries]
  );

  const jobGrowthFromSeries =
    totalSeries.length >= 2 && totalSeries[0] > 0
      ? ((totalSeries[totalSeries.length - 1] - totalSeries[0]) /
          totalSeries[0]) *
        100
      : null;
  const jobGrowthPct =
    jobs?.summary?.job_growth_pct_30d != null
      ? jobs.summary.job_growth_pct_30d
      : jobGrowthFromSeries;
  const jobGrowthLabel =
    jobs?.summary?.job_growth_pct_30d != null
      ? "vs last 30 days"
      : dateRange === "30d"
        ? "vs last 30 days"
        : dateRange === "90d"
          ? "vs last 90 days"
          : "vs last 12 months";

  type IndustryKey = "government" | "defense" | "healthcare" | "manufacturing" | "technology" | "education" | "public_safety";
  const INDUSTRY_KEY_MAP: Record<string, IndustryKey> = {
    Government: "government",
    Defense: "defense",
    Healthcare: "healthcare",
    Manufacturing: "manufacturing",
    Technology: "technology",
    Education: "education",
    "Public Safety": "public_safety",
  };
  const industryKey: IndustryKey | null = INDUSTRY_KEY_MAP[industryFilter] ?? null;

  const rangeLabel =
    dateRange === "30d"
      ? "Last 30 days"
      : dateRange === "90d"
        ? "Last 90 days"
        : "Last 12 months";

  const baseTotal = jobs?.summary.total_active_postings ?? 0;

  const federalRatio = useMemo(() => {
    if (!industries?.by_industry) return 0;
    const total = Object.values(industries.by_industry).reduce((a, b) => a + b, 0);
    if (total === 0) return 0;
    return (industries.by_industry.defense_federal ?? 0) / total;
  }, [industries]);

  const sectorAdjustedTotal =
    sectorFilter === "Public"
      ? Math.round(baseTotal * (jobs?.summary.public_ratio ?? 0.41))
      : sectorFilter === "Private"
        ? Math.round(baseTotal * (jobs?.summary.private_ratio ?? 0.59))
        : sectorFilter === "Federal"
          ? Math.round(baseTotal * federalRatio)
          : baseTotal;

  const ratioPrimary =
    sectorFilter === "Public"
      ? `${Math.round((jobs?.summary.public_ratio ?? 0.41) * 100)}% public`
      : sectorFilter === "Private"
        ? `${Math.round((jobs?.summary.private_ratio ?? 0.59) * 100)}% private`
        : sectorFilter === "Federal"
          ? `${Math.round(federalRatio * 100)}% federal`
          : jobs
            ? `${Math.round(jobs.summary.public_ratio * 100)}% public`
            : undefined;

  const ratioSecondary =
    sectorFilter === "all" && jobs
      ? `${Math.round(jobs.summary.private_ratio * 100)}% private`
      : "";

  const industryBreakdown: IndustryBarDatum[] =
    industries?.by_industry
      ? Object.entries(industries.by_industry)
          .map(([industry, postings]) => ({ industry, postings }))
          .sort((a, b) => b.postings - a.postings)
      : [];

  const neighborhoodPoints = useMemo(() =>
    neighborhoods?.neighborhoods.map((n, idx) => {
      const fallback = { lat: 32.3668, lng: -86.3006 };
      const coords = NEIGHBORHOOD_COORDS[n.name] ?? fallback;
      return {
        id: `${idx}-${n.name}`,
        name: n.name,
        lat: coords.lat,
        lng: coords.lng,
        job_density_score: n.job_density_score,
        workforce_desert: n.job_density_score < 30,
        top_sector: n.top_sector,
        cluster_type:
          n.top_sector === "federal"
            ? ("jobs" as const)
            : n.top_sector === "public"
              ? ("mixed" as const)
              : ("new_business" as const)
      };
    }) ?? [], [neighborhoods]);

  const skillsChartData: SkillDemandDatum[] = useMemo(() => {
    if (!skills || !jobs) return [];
    const counts: Record<string, number> = {};
    for (const job of jobs.jobs ?? []) {
      const jobSkills: string[] = job.skills ?? [];
      for (const s of jobSkills) {
        counts[s] = (counts[s] ?? 0) + 1;
      }
    }
    const top = skills.in_demand_skills_list
      .filter((s) => typeof s === "string")
      .slice(0, 8)
      .map((skill) => ({
        skill,
        postings: counts[skill] ?? 0
      }));
    return top;
  }, [skills, jobs]);

  const trainingAlignmentData: TrainingAlignmentDatum[] = useMemo(() => {
    if (!skills || !jobs) return [];
    const counts: Record<string, number> = {};
    for (const job of jobs.jobs ?? []) {
      const jobSkills: string[] = job.skills ?? [];
      for (const s of jobSkills) {
        counts[s] = (counts[s] ?? 0) + 1;
      }
    }
    return skills.skills_gap_list.slice(0, 8).map((gap) => {
      const demand = counts[gap.skill] ?? 0;
      const training_supply = gap.local_training_available ? Math.round(demand * 0.65) : 0;
      return {
        skill: gap.skill,
        demand,
        training_supply
      };
    });
  }, [skills, jobs]);

  const gapScore = useMemo(() => {
    if (!skills?.skills_gap_list?.length) return null;
    const gapCount = skills.skills_gap_list.filter((g) => g.gap).length;
    return Math.round((gapCount / skills.skills_gap_list.length) * 100);
  }, [skills]);

  const mainContent = (
    <div
      id="dashboard-report-root"
      className="mx-auto flex w-full max-w-[1600px] gap-3 px-3 py-4 laptop:px-4 desktop:px-6"
    >
            <section className="flex-1 space-y-4">
              <div className="flex flex-col gap-3">
                <DashboardFilters
                  industry={industryFilter}
                  sector={sectorFilter}
                  dateRange={dateRange}
                  onIndustryChange={setIndustryFilter}
                  onSectorChange={setSectorFilter}
                  onDateRangeChange={setDateRange}
                />
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-800/80 bg-slate-950/80 px-3 py-2 text-[11px]">
                  <div className="space-y-0.5">
                    <span className="font-medium text-slate-200">
                      Data freshness — Bright Data collection
                    </span>
                    <div className="text-slate-500">
                      {pipelineStatus?.last_run ? (
                        <>
                          Last run:{" "}
                          <span className="font-mono text-slate-300">
                            {new Date(pipelineStatus.last_run).toLocaleString()}
                          </span>
                          {" · "}
                          <span>
                            {pipelineStatus.jobs_count} jobs,{" "}
                            {pipelineStatus.business_signals_count} signals,{" "}
                            {pipelineStatus.glassdoor_count} employers,{" "}
                            {pipelineStatus.google_maps_count} local biz
                          </span>
                        </>
                      ) : (
                        "Pipeline has not been run yet. Initial run may take several minutes."
                      )}
                    </div>
                  </div>
                  <Button
                    variant="default"
                    size="sm"
                    className="text-[11px] uppercase tracking-[0.16em]"
                    disabled={pipelineRunning}
                    onClick={async () => {
                      try {
                        setPipelineRunning(true);
                        setError(null);
                        const res = await fetch(`${API_BASE}/api/run-pipeline`, {
                          method: "POST"
                        });
                        if (!res.ok) {
                          setError(`Pipeline request failed (${res.status}). Check backend logs.`);
                          return;
                        }
                        setError(null);
                      } catch (err) {
                        setError(
                          `Backend unreachable at ${API_BASE}. Start the API: uv run uvicorn backend.main:app --reload`
                        );
                      } finally {
                        // Progress polling will set pipelineRunning=false when backend reports complete
                        // Fallback: stop after 5 min if backend never reports done
                        setTimeout(() => setPipelineRunning(false), 300000);
                      }
                    }}
                  >
                    {pipelineRunning ? "Running..." : "Refresh data (deep run)"}
                  </Button>
                </div>
                {pipelineRunning && (
                  <div className="mt-2 space-y-2 rounded-md border border-slate-800/80 bg-slate-950/80 px-3 py-2.5 text-[11px]">
                    <div className="flex items-center gap-3">
                      <div className="relative flex h-5 w-5 shrink-0 items-center justify-center">
                        <div
                          className="absolute h-5 w-5 rounded-full border-2 border-orange-500/30 border-t-orange-400"
                          style={{ animation: "loader-orbital 1.2s linear infinite" }}
                        />
                        <img
                          src="https://www.brightdata.com/favicon.ico"
                          alt=""
                          className="relative h-2.5 w-2.5"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        {pipelineCurrentStep ? (
                          <span className="text-slate-200">{pipelineCurrentStep}</span>
                        ) : (
                          <span className="text-slate-400">Collection in progress…</span>
                        )}
                      </div>
                      <span className="shrink-0 font-mono text-slate-400">
                        {pipelineProgress}%
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-500"
                        style={{ width: `${Math.min(pipelineProgress, 100)}%` }}
                      />
                    </div>
                    {/* Per-stage breakdown */}
                    {pipelineStages.length > 0 && (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500">
                        {pipelineStages.map((s) => (
                          <span key={s.name}>
                            {s.status === "done" ? "✓" : s.status === "skipped" ? "–" : "…"}{" "}
                            <span className={s.status === "done" ? "text-slate-300" : ""}>
                              {s.name.replace(/_/g, " ")}
                            </span>
                            {s.status === "done" && (
                              <span className="ml-0.5 font-mono text-emerald-400/70">
                                ({s.items})
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {error && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-[11px] text-amber-200">
                  {error}
                </div>
              )}

              <section id="section-dashboard" className="space-y-3">
                <Card className="overflow-hidden border-slate-800/80 bg-gradient-to-r from-slate-900 via-slate-950 to-sky-950/30 shadow-xl shadow-slate-900/30 transition-all duration-300 hover:shadow-2xl">
                  <CardContent className="flex flex-col items-start justify-between gap-4 py-5 md:flex-row md:items-center md:gap-6">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-widest text-slate-500">
                        Montgomery, AL — Strategic Workforce Intelligence
                      </p>
                      {loading ? (
                        <Skeleton className="mt-2 h-10 w-32" />
                      ) : (
                        <p className="mt-2 text-4xl font-bold tracking-tight text-slate-50 md:text-5xl">
                          {jobs ? (
                            <AnimatedNumber value={baseTotal} useLocale animateOnMount />
                          ) : (
                            "—"
                          )}{" "}
                          <span className="text-xl font-semibold text-slate-400 md:text-2xl">
                            active postings
                          </span>
                        </p>
                      )}
                      <p className="mt-1 text-xs text-slate-500">
                        {jobs?.summary.top_growing_industry
                          ? `Leading sector: ${jobs.summary.top_growing_industry}`
                          : "Run the pipeline for live data"}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 rounded-xl border border-emerald-500/20 bg-emerald-950/20 px-4 py-3">
                      <span className="text-2xl font-bold tabular-nums text-emerald-400 drop-shadow-[0_0_12px_rgba(34,197,94,0.6)] motion-safe:animate-count-up">
                        {jobGrowthPct != null ? (
                          <AnimatedNumber
                            value={jobGrowthPct}
                            prefix={jobGrowthPct >= 0 ? "+" : ""}
                            suffix="%"
                            decimals={1}
                            useLocale={false}
                          />
                        ) : (
                          "—"
                        )}
                      </span>
                      <span className="text-[11px] uppercase tracking-wider text-slate-400">
                        {jobGrowthLabel}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex items-center gap-3 rounded-lg border border-emerald-900/30 bg-emerald-950/15 px-4 py-2.5">
                  <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-[11px] font-semibold text-emerald-300 uppercase tracking-wider">
                      Decision Support Mode
                    </p>
                    <p className="text-[11px] text-slate-400">
                      All metrics calibrated for strategic review. Live data from monitored workforce and economic sources.
                    </p>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
                <MetricCard
                  icon={<Radar className="h-4 w-4 text-amber-400" />}
                  label="Workforce Readiness Index"
                  animateValue={gapScore ?? undefined}
                  secondary="/ 100"
                  loading={loading}
                  tone="neutral"
                  actionThreshold={60}
                  actionMessage="Skills gap exceeds target — retraining investment needed"
                />
                <MetricCard
                  icon={<TrendingUp className="h-4 w-4 text-emerald-400" />}
                  label="Employment Growth Velocity"
                  animateValue={jobGrowthPct ?? undefined}
                  animatePrefix={jobGrowthPct != null && jobGrowthPct >= 0 ? "+" : ""}
                  animateSuffix="%"
                  animateDecimals={1}
                  primary={jobGrowthPct == null ? "—" : undefined}
                  secondary={jobGrowthLabel}
                  loading={loading}
                  tone="positive"
                  sparkline={totalSeries}
                />
                <MetricCard
                  icon={<ShieldCheck className="h-4 w-4 text-sky-400" />}
                  label="Sector Balance Indicator"
                  primary={
                    ratioPrimary
                  }
                  secondary={ratioSecondary}
                  loading={loading}
                  tone="neutral"
                  sparkline={
                    filteredTimeseries.map((p) => p.government) ?? []
                  }
                />
                <MetricCard
                  icon={<Building2 className="h-4 w-4 text-emerald-400" />}
                  label="Leading Growth Sector"
                  primary={jobs?.summary.top_growing_industry}
                  secondary={jobs?.summary.top_growing_industry ? "Leading sector by volume" : undefined}
                  loading={loading}
                  tone="positive"
                  sparkline={
                    filteredTimeseries.map((p) =>
                      industryKey ? (p as unknown as Record<string, number>)[industryKey] ?? 0 : p.healthcare
                    ) ?? []
                  }
                />
                <MetricCard
                  icon={<Factory className="h-4 w-4 text-sky-400" />}
                  label="Business Formation Rate"
                  animateValue={jobs?.summary.new_businesses_this_month ?? 0}
                  delta={
                    signals?.signals.find(
                      (s) => s.id === "new_registrations"
                    )?.delta_30d
                  }
                  loading={loading}
                  tone="positive"
                  sparkline={totalSeries.slice(-6)}
                />
                </div>
              </section>

              <section id="section-hiring-trends" className="space-y-3">
                {loading ? (
                  <Skeleton className="h-[360px] w-full rounded-xl bg-slate-900/80" />
                ) : filteredTimeseries.length === 0 ? (
                  <Card className="border-slate-800/80 bg-slate-950/80">
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                      <TrendingUp className="mb-3 h-8 w-8 text-slate-600" />
                      <p className="text-sm font-medium text-slate-400">No hiring trend data yet</p>
                      <p className="mt-1 text-xs text-slate-600">Run the data pipeline to populate hiring trends.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <ErrorBoundary>
                    <HiringTrendsChart
                      data={filteredTimeseries}
                      highlight={industryKey}
                      rangeLabel={rangeLabel}
                      demoMode={demo.enabled}
                    />
                  </ErrorBoundary>
                )}
              </section>

              <section id="section-neighborhood-insights" className="space-y-3">
                {loading || !neighborhoods ? (
                  <Skeleton className="h-[420px] w-full rounded-xl bg-slate-900/80" />
                ) : (
                  <ErrorBoundary>
                    <WorkforceMap data={neighborhoodPoints} />
                  </ErrorBoundary>
                )}
              </section>

              <section id="section-data-center-impact" className="space-y-3">
                <SectionLabel
                  title="Infrastructure Impact Modeling"
                  description="Data center expansion impact on Montgomery's workforce and infrastructure capacity."
                />
                <DataCenterImpactCard
                  signalCount={
                    (signals?.signals ?? []).filter(
                      (s: any) => s.signal_type === "data_center" || (s.label ?? "").toLowerCase().includes("data center")
                    ).length
                  }
                  totalJobs={baseTotal}
                />
              </section>

              <section className="grid gap-3 lg:grid-cols-12">
                <div id="section-skills-gap" className="space-y-3 lg:col-span-6">
                  {loading || !skills ? (
                    <Skeleton className="h-[300px] w-full rounded-xl bg-slate-900/80" />
                  ) : (
                    <SkillsDemandChart data={skillsChartData} demoMode={demo.enabled} />
                  )}
                </div>
                <div id="section-economic-signals" className="lg:col-span-6">
                  <EconomicSignalsStack signals={signals?.signals ?? []} />
                </div>
              </section>

              <section className="grid gap-3 lg:grid-cols-12">
                <div
                  id="section-industry-breakdown"
                  className="space-y-3 lg:col-span-8"
                >
                  {loading || !industries ? (
                    <Skeleton className="h-[300px] w-full rounded-xl bg-slate-900/80" />
                  ) : (
                    <IndustryBreakdownChart
                      data={industryBreakdown}
                      demoMode={demo.enabled}
                    />
                  )}
                </div>

                <aside className="space-y-3 lg:col-span-4" id="section-policy-insights">
                  <AskWorkforcePulse />
                  <ScenarioSimulator />
                  <SectionLabel
                    title="Policy Intelligence Panel"
                    description="AI-generated policy recommendations from Montgomery’s live economic data."
                  />
                  <Card className="border-sky-900/60 bg-slate-950/80 shadow-lg shadow-slate-900/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl">
                    <CardContent className="space-y-3 py-3">
                      {loading && (
                        <div className="space-y-2">
                          <Skeleton className="h-3 w-5/6" />
                          <Skeleton className="h-3 w-4/6" />
                          <Skeleton className="h-3 w-3/6" />
                        </div>
                      )}
                      {!loading && insights && insights.length > 0 && (
                        <ul className="space-y-2">
                          {insights.map((item, idx) => (
                            <li
                              key={idx}
                              className="flex gap-2 text-xs leading-relaxed text-slate-200"
                            >
                              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-400" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {!loading && (!insights || insights.length === 0) && (
                        <p className="py-4 text-center text-xs text-slate-500">
                          No AI insights available. Run the data pipeline to generate insights.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </aside>
              </section>

              <section id="section-training-alignment" className="space-y-3">
                  <SectionLabel
                    title="Training Investment Alignment"
                    description="Investment alignment: university output vs. employer demand signals."
                  />
                  {loading || !skills ? (
                    <Skeleton className="h-[300px] w-full rounded-xl bg-slate-900/80" />
                  ) : (
                    <TrainingAlignmentChart
                      data={trainingAlignmentData}
                    />
                  )}
                  <Card className="shadow-lg shadow-slate-900/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl">
                    <CardHeader>
                      <CardTitle>Key education partners</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-[11px] text-slate-300">
                      <p>
                        Aligning{" "}
                        <span className="font-semibold">Alabama State University</span>,{" "}
                        <span className="font-semibold">Auburn University Montgomery</span>, and{" "}
                        <span className="font-semibold">Trenholm State</span>{" "}
                        to close{" "}
                        {skills?.skills_gap_list
                          ?.filter((g) => g.gap)
                          ?.slice(0, 3)
                          ?.map((g) => g.skill)
                          ?.join(", ") || "key workforce"}{" "}
                        gaps.
                      </p>
                      <p className="flex items-center gap-2 text-sky-300">
                        <FileText className="h-3 w-3" />
                        <span>
                          Export alignment brief as part of workforce
                          strategy packet.
                        </span>
                      </p>
                    </CardContent>
                  </Card>
              </section>
            </section>
          </div>
  );

  return mainContent;
}

function SectionLabel({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          {title}
        </span>
      </div>
      <p className="text-[11px] text-slate-500">{description}</p>
    </div>
  );
}

function MetricCard(props: {
  icon: React.ReactNode;
  label: string;
  primary?: string;
  secondary?: string;
  delta?: number;
  loading?: boolean;
  tone?: "positive" | "negative" | "neutral";
  sparkline?: number[];
  animateValue?: number;
  animatePrefix?: string;
  animateSuffix?: string;
  animateDecimals?: number;
  actionThreshold?: number;
  actionMessage?: string;
}) {
  const {
    icon,
    label,
    primary,
    secondary,
    delta,
    loading,
    tone = "neutral",
    sparkline = [],
    animateValue,
    animatePrefix = "",
    animateSuffix = "",
    animateDecimals = 0,
    actionThreshold,
    actionMessage
  } = props;

  const deltaTone =
    tone === "positive"
      ? "text-emerald-400"
      : tone === "negative"
        ? "text-red-400"
        : "text-slate-400";

  const showPrimaryGlow =
    tone === "positive" &&
    (primary?.startsWith("+") || (animatePrefix === "+" && animateSuffix === "%"));

  const primaryDisplay =
    animateValue != null ? (
      <AnimatedNumber
        value={animateValue}
        prefix={animatePrefix}
        suffix={animateSuffix}
        decimals={animateDecimals}
        useLocale={animateDecimals === 0}
        duration={500}
      />
    ) : (
      primary ?? "—"
    );

  return (
    <Card className="group relative overflow-hidden bg-gradient-to-br from-slate-950/80 via-slate-950 to-slate-950/60 shadow-lg shadow-slate-900/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-800/40 motion-safe:animate-fade-in">
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="absolute right-[-40%] top-[-40%] h-40 w-40 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute left-[-40%] bottom-[-40%] h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>
      <CardContent className="relative flex items-start gap-3 py-2.5">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900/90 text-slate-200 transition-colors">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-slate-400">
            {label}
          </p>
          {loading ? (
            <div className="mt-2 space-y-1.5">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
          ) : (
            <>
              <div
                className={`mt-1 text-lg font-semibold tracking-tight transition-opacity motion-safe:animate-count-up ${
                  showPrimaryGlow
                    ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]"
                    : "text-slate-50"
                }`}
              >
                {primaryDisplay}
              </div>
              <div className="mt-0.5 flex items-center justify-between text-[11px] text-slate-500">
                <span>{secondary}</span>
                {delta != null && (
                  <span
                    className={`${deltaTone} ${tone === "positive" && delta >= 0 ? "drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]" : ""}`}
                  >
                    {delta >= 0 ? "+" : ""}
                    {Math.abs(delta).toFixed(1)}% ↑ vs 30d
                  </span>
                )}
              </div>
              {sparkline.length > 1 && (
                <div className="mt-2 h-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={sparkline.map((v, i) => ({ i, v }))}
                      margin={{ left: 0, right: 0, top: 2, bottom: 2 }}
                    >
                      <Line
                        type="monotone"
                        dataKey="v"
                        stroke={
                          tone === "positive"
                            ? "#22c55e"
                            : tone === "negative"
                              ? "#ef4444"
                              : "#2563eb"
                        }
                        strokeWidth={1.6}
                        dot={false}
                        opacity={0.9}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              {actionThreshold != null && typeof animateValue === "number" && animateValue > actionThreshold && (
                <div className="mt-1.5 flex items-center gap-1 text-[10px] font-medium text-amber-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-[soft-pulse_2.2s_infinite]" />
                  {actionMessage ?? "Action recommended"}
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

const SIGNAL_GROUP_ORDER = [
  "company_profile",
  "company_funding",
  "data_center",
  "expansion",
  "defense_contract",
  "economic_development",
  "real_estate",
  "hiring_surge",
  "new_business",
  "infrastructure",
  "general",
] as const;

const SIGNAL_GROUP_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; badgeClass: string }
> = {
  company_funding: {
    label: "Company funding",
    icon: <TrendingUp className="h-3 w-3" />,
    badgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  },
  company_profile: {
    label: "Key employers",
    icon: <Building2 className="h-3 w-3" />,
    badgeClass: "bg-sky-500/20 text-sky-300 border-sky-500/30",
  },
  data_center: {
    label: "Data center & tech",
    icon: <Database className="h-3 w-3" />,
    badgeClass: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  },
  expansion: {
    label: "Expansion & investment",
    icon: <TrendingUp className="h-3 w-3" />,
    badgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  },
  defense_contract: {
    label: "Defense & federal",
    icon: <ShieldCheck className="h-3 w-3" />,
    badgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  },
  economic_development: {
    label: "Economic development",
    icon: <Activity className="h-3 w-3" />,
    badgeClass: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  },
  real_estate: {
    label: "Commercial real estate",
    icon: <MapPin className="h-3 w-3" />,
    badgeClass: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  },
  hiring_surge: {
    label: "Hiring & staffing",
    icon: <Users className="h-3 w-3" />,
    badgeClass: "bg-teal-500/20 text-teal-300 border-teal-500/30",
  },
  new_business: {
    label: "New businesses",
    icon: <Building2 className="h-3 w-3" />,
    badgeClass: "bg-lime-500/20 text-lime-300 border-lime-500/30",
  },
  infrastructure: {
    label: "Infrastructure",
    icon: <Factory className="h-3 w-3" />,
    badgeClass: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  },
  general: {
    label: "General",
    icon: <FileText className="h-3 w-3" />,
    badgeClass: "bg-slate-600/20 text-slate-400 border-slate-600/30",
  },
};

const INITIAL_PER_GROUP = 5;

function EconomicSignalsStack({
  signals
}: {
  signals: (EconomicSignal | Record<string, unknown>)[];
}) {
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(["company_profile"])
  );
  const [visibleCount, setVisibleCount] = useState<Record<string, number>>({});

  const grouped = signals.reduce<Record<string, typeof signals>>((acc, s) => {
    const t =
      (s as Record<string, unknown>).signal_type ??
      (s as Record<string, unknown>).source ??
      "general";
    const key = String(t);
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const showMore = (key: string) => {
    setVisibleCount((prev) => ({
      ...prev,
      [key]: (prev[key] ?? INITIAL_PER_GROUP) + 10,
    }));
  };

  const knownGroups = SIGNAL_GROUP_ORDER.filter((k) => grouped[k]?.length);
  const unknownKeys = Object.keys(grouped).filter(
    (k) => !SIGNAL_GROUP_ORDER.includes(k as (typeof SIGNAL_GROUP_ORDER)[number])
  );
  const orderedGroups = [...knownGroups, ...unknownKeys];

  if (signals.length === 0) {
    return (
      <div id="section-economic-signals" className="space-y-2">
        <SectionLabel
          title="Economic signal stack"
          description="Run the pipeline to collect business signals."
        />
      </div>
    );
  }

  return (
    <div id="section-economic-signals" className="space-y-2">
      <SectionLabel
        title="Economic signal stack"
        description="Grouped by type. Click a category to expand or collapse."
      />
      <div className="space-y-1">
        {orderedGroups.map((key) => {
          const items = grouped[key];
          const config =
            SIGNAL_GROUP_CONFIG[key] ?? {
              ...SIGNAL_GROUP_CONFIG.general,
              label: key.replace(/_/g, " "),
            };
          const isOpen = expanded.has(key);
          const limit =
            visibleCount[key] ?? (isOpen ? items.length : INITIAL_PER_GROUP);
          const visible = items.slice(0, limit);
          const hasMore = items.length > limit;
          const hiddenCount = items.length - limit;

          return (
            <div
              key={key}
              className="rounded-lg border border-slate-800/80 bg-slate-950/50 overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggle(key)}
                className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left hover:bg-slate-800/30 transition-colors"
              >
                <span className="flex items-center gap-2">
                  {isOpen ? (
                    <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                  )}
                  <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase ${config.badgeClass}`}>
                    {config.label}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {items.length} signal{items.length !== 1 ? "s" : ""}
                  </span>
                </span>
              </button>
              {isOpen && (
                <div className="border-t border-slate-800/80">
                  {visible.map((signal, i) => (
                    <EconomicSignalRow
                      key={`${key}-${i}`}
                      signal={signal}
                    />
                  ))}
                  {hasMore && (
                    <button
                      type="button"
                      onClick={() => showMore(key)}
                      className="w-full px-2.5 py-2 text-[11px] text-sky-400 hover:bg-slate-800/30 hover:text-sky-300 transition-colors"
                    >
                      + Show {Math.min(10, hiddenCount)} more
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EconomicSignalRow({
  signal
}: {
  signal: EconomicSignal | Record<string, unknown>;
}) {
  const title =
    (signal as EconomicSignal).label ??
    (signal as Record<string, unknown>).title ??
    "—";
  const value =
    (signal as EconomicSignal).value ??
    (signal as Record<string, unknown>).employee_count ??
    (signal as Record<string, unknown>).total_funding ??
    null;
  const url = (signal as Record<string, unknown>).url as string | undefined;

  return (
    <div className="flex items-center justify-between gap-2 border-b border-slate-800/50 last:border-b-0 px-2.5 py-1.5 hover:bg-slate-800/20 min-h-0">
      <p className="truncate text-[11px] text-slate-300 flex-1 min-w-0">
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-sky-300 transition-colors truncate block"
          >
            {title}
          </a>
        ) : (
          title
        )}
      </p>
      {value != null && (
        <span className="shrink-0 text-[10px] font-medium text-slate-400 tabular-nums">
          {typeof value === "number"
            ? value.toLocaleString()
            : String(value)}
        </span>
      )}
    </div>
  );
}

