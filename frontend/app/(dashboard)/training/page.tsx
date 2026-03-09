"use client";

import { useMemo } from "react";
import { useDashboardData } from "../../../lib/DashboardDataContext";
import { TrainingAlignmentChart } from "../../../components/charts/TrainingAlignmentChart";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";
import { FileText } from "lucide-react";
import type { TrainingAlignmentDatum } from "../../../components/charts/TrainingAlignmentChart";

export default function TrainingPage() {
  const { jobs, skills, loading } = useDashboardData();

  const trainingData: TrainingAlignmentDatum[] = useMemo(() => {
    if (!skills || !jobs) return [];
    const counts: Record<string, number> = {};
    for (const job of jobs.jobs ?? []) {
      const jobSkills: string[] = job.skills ?? [];
      for (const s of jobSkills) counts[s] = (counts[s] ?? 0) + 1;
    }
    return (skills.skills_gap_list ?? []).slice(0, 10).map((gap) => {
      const demand = counts[gap.skill] ?? 0;
      return {
        skill: gap.skill,
        demand,
        training_supply: gap.local_training_available ? Math.round(demand * 0.65) : 0,
      };
    });
  }, [skills, jobs]);

  return (
    <div className="mx-auto w-full max-w-[1600px] gap-3 px-3 py-4 laptop:px-4 desktop:px-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-100">Training Alignment</h1>
        <p className="text-sm text-slate-400">
          How Montgomery's universities and colleges map to real hiring demand.
        </p>
      </div>
      <div className="space-y-6">
        {loading ? (
          <Skeleton className="h-[320px] w-full rounded-xl bg-slate-900/80" />
        ) : (
          <TrainingAlignmentChart data={trainingData} />
        )}
        <Card className="border-sky-900/60 shadow-lg">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-slate-200">
              Key education partners
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-[11px] text-slate-300">
            <p>
              Aligning{" "}
              <span className="font-semibold">Alabama State University</span>,{" "}
              <span className="font-semibold">Auburn University Montgomery</span>, and{" "}
              <span className="font-semibold">Trenholm State</span>{" "}
              to close{" "}
              {skills?.skills_gap_list
                ?.filter((g: { gap: boolean }) => g.gap)
                ?.slice(0, 3)
                ?.map((g: { skill: string }) => g.skill)
                ?.join(", ") || "key workforce"}{" "}
              gaps.
            </p>
            <p className="flex items-center gap-2 text-sky-300">
              <FileText className="h-3 w-3" />
              Export alignment brief as part of workforce strategy packet.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
