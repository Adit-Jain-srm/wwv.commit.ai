"use client";

import { useMemo } from "react";
import { useDashboardData } from "../../../lib/DashboardDataContext";
import { SkillsDemandClusters } from "../../../components/dashboard/SkillsDemandClusters";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";
import { useDemoMode } from "../../../lib/DemoModeContext";

export default function SkillsPage() {
  const { jobs, skills, loading } = useDashboardData();
  const demo = useDemoMode();

  const skillsDemand = useMemo(() => {
    if (!skills || !jobs) return [];
    const counts: Record<string, number> = {};
    for (const job of jobs.jobs ?? []) {
      const jobSkills: string[] = job.skills ?? [];
      for (const s of jobSkills) counts[s] = (counts[s] ?? 0) + 1;
    }
    return (skills.in_demand_skills_list ?? [])
      .filter((s): s is string => typeof s === "string")
      .slice(0, 30)
      .map((skill) => ({ skill, postings: counts[skill] ?? 0 }));
  }, [skills, jobs]);

  const gaps = useMemo(() => {
    return skills?.skills_gap_list ?? [];
  }, [skills]);

  const gapScore = useMemo(() => {
    if (!gaps.length) return 0;
    const gapCount = gaps.filter((g) => g.gap).length;
    return Math.round((gapCount / gaps.length) * 100);
  }, [gaps]);

  const topShortages = useMemo(() => {
    return gaps
      .filter((g) => g.gap)
      .map((g) => g.skill)
      .slice(0, 5);
  }, [gaps]);

  return (
    <div className="mx-auto w-full max-w-[1600px] gap-3 px-3 py-4 laptop:px-4 desktop:px-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-100">Skills Gap Analysis</h1>
        <p className="text-sm text-slate-400">
          In-demand skills and workforce readiness. Focus training programs on largest shortages.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="overflow-hidden border-slate-800/80 bg-gradient-to-br from-slate-950 to-sky-950/20 shadow-lg">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-slate-200">
              Workforce Gap Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-slate-50">{gapScore}</span>
              <span className="text-slate-400">/ 100</span>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 via-emerald-500 to-sky-500"
                style={{ width: `${gapScore}%` }}
              />
            </div>
            <p className="mt-3 text-[11px] text-slate-500">
              Largest shortages:
            </p>
            <ul className="mt-1 space-y-1">
              {topShortages.map((s) => (
                <li key={s} className="text-xs text-slate-300">
                  • {s}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <div className="lg:col-span-2">
          {loading ? (
            <Skeleton className="h-[320px] w-full rounded-xl bg-slate-900/80" />
          ) : (
            <SkillsDemandClusters
              data={skillsDemand}
              demoMode={demo.enabled}
            />
          )}
        </div>
      </div>
    </div>
  );
}
