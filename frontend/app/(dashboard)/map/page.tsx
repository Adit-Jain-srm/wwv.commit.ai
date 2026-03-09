"use client";

import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";
import { useDashboardData } from "../../../lib/DashboardDataContext";
import { NEIGHBORHOOD_COORDS } from "../../../lib/montgomery-geo";

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
  const neighborhoodPoints = neighborhoods?.neighborhoods?.map((n, idx) => {
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
      </div>
      {loading ? (
        <Skeleton className="h-[600px] w-full rounded-xl bg-slate-900/80" />
      ) : (
        <WorkforceIntelligenceMap data={neighborhoodPoints} />
      )}
    </div>
  );
}
