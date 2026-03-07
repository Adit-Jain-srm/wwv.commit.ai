"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

export type SkillClusterDatum = {
  skill: string;
  postings: number;
};

type ClusterKey = "technology" | "healthcare" | "defense" | "government" | "manufacturing" | "education" | "public_safety";

const CLUSTER_LABELS: Record<ClusterKey, string> = {
  technology: "Technology",
  healthcare: "Healthcare",
  defense: "Defense",
  government: "Gov & Admin",
  manufacturing: "Mfg & Trades",
  education: "Education",
  public_safety: "Public Safety",
};

const CLUSTER_STYLES: Record<ClusterKey, { accent: string; chip: string }> = {
  technology: { accent: "#38bdf8", chip: "border-sky-700/60 bg-sky-950/30 text-sky-200" },
  healthcare: { accent: "#22c55e", chip: "border-emerald-700/60 bg-emerald-950/25 text-emerald-200" },
  defense: { accent: "#a855f7", chip: "border-violet-700/60 bg-violet-950/25 text-violet-200" },
  government: { accent: "#38bdf8", chip: "border-sky-700/60 bg-sky-950/30 text-sky-200" },
  manufacturing: { accent: "#f97316", chip: "border-orange-700/60 bg-orange-950/25 text-orange-200" },
  education: { accent: "#facc15", chip: "border-yellow-700/60 bg-yellow-950/25 text-yellow-200" },
  public_safety: { accent: "#f97373", chip: "border-red-700/60 bg-red-950/25 text-red-200" },
};

function classify(skill: string): ClusterKey | "other" {
  const s = skill.toLowerCase();
  if (/(python|ai|ml|machine|cloud|aws|azure|gcp|data|sql|devops|kubernetes|react|node|javascript|typescript)/.test(s)) {
    return "technology";
  }
  if (/(nurs|nursing|medical|patient|clinical|health|pharma|radiolog|emt|care|cna)/.test(s)) {
    return "healthcare";
  }
  if (/(cyber|security|infosec|systems|engineering|intel|intelligence|clearance|network|defense)/.test(s)) {
    return "defense";
  }
  if (/(policy|regulation|compliance|public.?admin|grant|legislative|municipal|civic|budget|procurement|zoning|government)/.test(s)) {
    return "government";
  }
  if (/(weld|cnc|machin|assembly|lean|six.?sigma|quality|supply.?chain|logist|warehouse|forklift|hvac|plumb|electri|carpent|construct|manufactur|mechanic|maintena)/.test(s)) {
    return "manufacturing";
  }
  if (/(teach|curriculum|pedagog|tutor|student|instruction|classroom|esl|k.?12|higher.?ed|education|academic)/.test(s)) {
    return "education";
  }
  if (/(fire|ems|law.?enforce|dispatch|emergency|hazmat|rescue|patrol|correction|criminal|public.?safe|police|officer)/.test(s)) {
    return "public_safety";
  }
  return "other";
}

const PROJECTION_FACTOR = 1.14;

export function SkillsDemandClusters({
  data,
  highlightSkill,
  demoMode = false,
}: {
  data: SkillClusterDatum[];
  highlightSkill?: string | null;
  demoMode?: boolean;
}) {
  const clusters = useMemo(() => {
    const out: Record<ClusterKey, SkillClusterDatum[]> = {
      technology: [],
      healthcare: [],
      defense: [],
      government: [],
      manufacturing: [],
      education: [],
      public_safety: [],
    };
    for (const d of data) {
      const c = classify(d.skill);
      if (c === "other") continue;
      out[c].push(d);
    }
    for (const k of Object.keys(out) as ClusterKey[]) {
      out[k] = out[k].sort((a, b) => b.postings - a.postings).slice(0, 6);
    }
    return out;
  }, [data]);

  const max = demoMode
    ? Math.max(1, ...data.map((d) => Math.round(d.postings * PROJECTION_FACTOR)))
    : Math.max(1, ...data.map((d) => d.postings));
  const hi = highlightSkill?.trim().toLowerCase() ?? null;

  const activeClusterKeys = useMemo(
    () => (Object.keys(clusters) as ClusterKey[]).filter((k) => clusters[k].length > 0),
    [clusters]
  );

  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
      {activeClusterKeys.map((k) => {
        const accent = CLUSTER_STYLES[k].accent;
        const items = clusters[k];
        return (
          <Card
            key={k}
            className="overflow-hidden border-slate-800/80 bg-gradient-to-br from-slate-950 to-slate-950/40 shadow-lg shadow-slate-900/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl"
          >
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between gap-2 text-sm font-semibold text-slate-200">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: accent, boxShadow: `0 0 16px ${accent}33` }}
                  />
                  <span className="truncate">{CLUSTER_LABELS[k]}</span>
                </span>
                <span className={`shrink-0 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[9px] uppercase tracking-wider ${CLUSTER_STYLES[k].chip}`}>
                  {demoMode ? "6mo proj" : "cluster"}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {items.map((it) => {
                  const val = demoMode ? Math.round(it.postings * PROJECTION_FACTOR) : it.postings;
                  const w = Math.max(6, Math.round((val / max) * 100));
                  const isHi = hi ? it.skill.toLowerCase().includes(hi) || hi.includes(it.skill.toLowerCase()) : false;
                  return (
                    <div key={it.skill} className="space-y-1">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className={`truncate ${isHi ? "text-slate-50" : "text-slate-300"}`}>
                          {it.skill}
                        </span>
                        <span className={`shrink-0 font-mono text-[11px] ${isHi ? "text-emerald-300" : "text-slate-500"}`}>
                          {demoMode ? (
                            <>
                              {it.postings.toLocaleString()}
                              <span className="text-emerald-400/90"> → {val.toLocaleString()}</span>
                            </>
                          ) : (
                            it.postings.toLocaleString()
                          )}
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-800">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-700 ${demoMode ? "ease-out" : ""}`}
                          style={{
                            width: `${w}%`,
                            background: `linear-gradient(90deg, ${accent}CC, ${accent}33)`,
                            boxShadow: isHi ? `0 0 14px ${accent}44` : "none",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

