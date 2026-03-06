"use client";

import { useMemo } from "react";
import { useDashboardData } from "../../../lib/DashboardDataContext";
import { HiringTrendsChart } from "../../../components/charts/HiringTrendsChart";
import { IndustryBreakdownChart } from "../../../components/charts/IndustryBreakdownChart";
import { Skeleton } from "../../../components/ui/skeleton";
import type { HiringTimeseriesPoint } from "../../../lib/DashboardDataContext";
import type { IndustryBarDatum } from "../../../components/charts/IndustryBreakdownChart";
import { useSearch } from "../../../lib/SearchContext";
import { useDemoMode } from "../../../lib/DemoModeContext";

export default function HiringPage() {
  const { jobs, industries, loading } = useDashboardData();
  const { filters, query } = useSearch();
  const demo = useDemoMode();

  const timeseries: HiringTimeseriesPoint[] = jobs?.timeseries ?? [];
  const industryBreakdown: IndustryBarDatum[] = industries?.by_industry
    ? Object.entries(industries.by_industry)
        .map(([industry, postings]) => ({ industry, postings }))
        .sort((a, b) => b.postings - a.postings)
    : [];

  const highlight = useMemo(() => {
    const q = (filters.industry ?? query).trim().toLowerCase();
    if (!q) return null;
    if (q.includes("government")) return "government" as const;
    if (q.includes("defense")) return "defense" as const;
    if (q.includes("health")) return "healthcare" as const;
    if (q.includes("manuf")) return "manufacturing" as const;
    if (q.includes("tech")) return "technology" as const;
    if (q.includes("educ")) return "education" as const;
    if (q.includes("public safety") || q.includes("safety")) return "public_safety" as const;
    return null;
  }, [filters.industry, query]);

  return (
    <div className="mx-auto w-full max-w-[1600px] gap-3 px-3 py-4 laptop:px-4 desktop:px-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-100">Hiring Trends</h1>
        <p className="text-sm text-slate-400">
          Postings by industry over time. Toggle industries in the legend to focus on specific sectors.
        </p>
      </div>
      <div className="space-y-6">
        {loading ? (
          <Skeleton className="h-[360px] w-full rounded-xl bg-slate-900/80" />
        ) : (
          <HiringTrendsChart data={timeseries} rangeLabel="Last 90 days" highlight={highlight} demoMode={demo.enabled} />
        )}
        {loading ? (
          <Skeleton className="h-[300px] w-full rounded-xl bg-slate-900/80" />
        ) : (
          <IndustryBreakdownChart data={industryBreakdown} demoMode={demo.enabled} />
        )}
      </div>
    </div>
  );
}
