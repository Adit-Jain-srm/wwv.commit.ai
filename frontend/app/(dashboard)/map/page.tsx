"use client";

import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";
import { useDashboardData } from "../../../lib/DashboardDataContext";
import { useSearch } from "../../../lib/SearchContext";

const WorkforceIntelligenceMap = dynamic(
  () => import("../../../components/maps/WorkforceIntelligenceMap").then((m) => m.WorkforceIntelligenceMap),
  {
    ssr: false,
    loading: () => (
      <Card className="min-h-[500px]">
        <CardHeader>
          <CardTitle>Workforce Intelligence Map</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[480px] w-full rounded-xl bg-slate-900/80" />
        </CardContent>
      </Card>
    ),
  }
);

export default function MapPage() {
  const { neighborhoods, loading } = useDashboardData();
  const { filters, query } = useSearch();
  const neighborhoodPoints = neighborhoods?.neighborhoods?.map((n, idx) => {
    const mapping: Record<string, { lat: number; lng: number }> = {
      "Downtown Montgomery": { lat: 32.3775, lng: -86.3077 },
      "Maxwell / Gunter Area": { lat: 32.3827, lng: -86.3652 },
      "East Montgomery": { lat: 32.366, lng: -86.154 },
    };
    const fallback = { lat: 32.3668, lng: -86.3006 };
    const coords = mapping[n.name] ?? fallback;
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
            : ("new_business" as const),
    };
  }) ?? [];

  return (
    <div className="mx-auto w-full max-w-[1600px] gap-3 px-3 py-4 laptop:px-4 desktop:px-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-slate-100">Workforce Intelligence Map</h1>
        <p className="text-sm text-slate-400">
          Interactive map of workforce activity across Montgomery, Alabama. Toggle layers to explore job density, business growth, and skills demand.
        </p>
        {(filters.neighborhood ?? query.trim()) && (
          <p className="mt-2 text-[11px] text-slate-500">
            Intelligence filter:{" "}
            <span className="font-semibold text-slate-200">
              {filters.neighborhood ?? query.trim()}
            </span>
          </p>
        )}
      </div>
      {loading ? (
        <Skeleton className="h-[600px] w-full rounded-xl bg-slate-900/80" />
      ) : (
        <WorkforceIntelligenceMap data={neighborhoodPoints} />
      )}
    </div>
  );
}
