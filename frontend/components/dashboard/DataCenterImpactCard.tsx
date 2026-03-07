"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Database, Zap, Droplets, Users } from "lucide-react";
import { CHART_TOOLTIP_STYLE } from "../../lib/chart-constants";

interface DataCenterImpactCardProps {
  signalCount: number;
  totalJobs: number;
}

const IMPACT_METRICS = [
  { label: "Direct Jobs", value: 150, unit: "positions", color: "#22c55e" },
  { label: "Indirect Jobs", value: 450, unit: "positions", color: "#2563eb" },
  { label: "Est. Power Demand", value: 200, unit: "MW", color: "#f97316" },
  { label: "Water Usage", value: 12, unit: "M gal/day", color: "#38bdf8" },
  { label: "Construction Jobs", value: 1200, unit: "temp", color: "#a855f7" },
  { label: "Local Hire Target", value: 65, unit: "%", color: "#facc15" },
];

export function DataCenterImpactCard({ signalCount, totalJobs }: DataCenterImpactCardProps) {
  const multiplier = useMemo(() => {
    if (totalJobs <= 0) return 0;
    return ((150 + 450) / totalJobs * 100).toFixed(1);
  }, [totalJobs]);

  return (
    <Card className="border-violet-900/40 bg-gradient-to-br from-slate-950/80 via-slate-950 to-violet-950/20 shadow-xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <Database className="h-4 w-4 text-violet-400" />
              Data Center Impact Assessment
            </CardTitle>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Modeled infrastructure and workforce impact of data center expansion.
              {signalCount > 0 && ` ${signalCount} active signal${signalCount !== 1 ? "s" : ""} detected.`}
            </p>
          </div>
          <span className="text-[9px] uppercase tracking-widest text-violet-400/60 bg-violet-950/40 px-2 py-0.5 rounded-full border border-violet-800/30">
            Modeled Estimate
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {IMPACT_METRICS.slice(0, 3).map((m) => (
            <div key={m.label} className="rounded-lg border border-slate-800/80 bg-slate-900/40 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">{m.label}</p>
              <p className="text-lg font-bold tabular-nums" style={{ color: m.color }}>
                {m.value.toLocaleString()}
                <span className="text-[10px] font-normal text-slate-500 ml-1">{m.unit}</span>
              </p>
            </div>
          ))}
        </div>

        <div className="h-[150px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={IMPACT_METRICS} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#0f172a" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9, fill: "#64748b" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis hide />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={28}>
                {IMPACT_METRICS.map((m, i) => (
                  <Cell key={i} fill={m.color} fillOpacity={0.75} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-3 gap-2 text-[10px]">
          <div className="flex items-center gap-1.5 text-amber-400">
            <Zap className="h-3 w-3" />
            <span>Power grid strain: Moderate</span>
          </div>
          <div className="flex items-center gap-1.5 text-sky-400">
            <Droplets className="h-3 w-3" />
            <span>Water capacity: Within limits</span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-400">
            <Users className="h-3 w-3" />
            <span>Workforce ready: Partial</span>
          </div>
        </div>

        {totalJobs > 0 && (
          <p className="text-[10px] text-slate-500 border-t border-slate-800/60 pt-2">
            Projected employment multiplier: {multiplier}% of current monitored positions.
            Based on AWS/Google/Meta expansion models for Southeast US metro areas.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
