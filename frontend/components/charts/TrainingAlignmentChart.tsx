"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { CHART_TOOLTIP_STYLE } from "../../lib/chart-constants";

export type TrainingAlignmentDatum = {
  skill: string;
  demand: number;
  training_supply: number;
};

interface TrainingAlignmentChartProps {
  data: TrainingAlignmentDatum[];
}

export function TrainingAlignmentChart({
  data
}: TrainingAlignmentChartProps) {
  const criticalGaps = useMemo(() =>
    data.filter(d => d.demand > 0 && d.training_supply < d.demand * 0.5).length
  , [data]);

  return (
    <Card className="h-[340px] shadow-lg shadow-slate-900/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl">
      <CardHeader>
        <CardTitle>Training Pipeline Alignment — Capacity vs. Demand</CardTitle>
        {criticalGaps > 0 && (
          <div className="flex items-center gap-1.5 mt-1">
            <AlertTriangle className="h-3 w-3 text-amber-400" />
            <span className="text-[10px] font-medium text-amber-400">
              {criticalGaps} critical gap{criticalGaps !== 1 ? "s" : ""} detected — retraining investment needed
            </span>
          </div>
        )}
      </CardHeader>
      <CardContent className="h-[270px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: 0, right: 10, top: 5 }}>
            <defs>
              <linearGradient id="demandBarGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563eb" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#1e40af" stopOpacity={0.7} />
              </linearGradient>
              <linearGradient id="supplyBarGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#15803d" stopOpacity={0.7} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#0f172a"
              vertical={false}
            />
            <XAxis
              dataKey="skill"
              tickLine={false}
              axisLine={false}
              stroke="#64748b"
              tick={{ fontSize: 10 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              stroke="#64748b"
              tick={{ fontSize: 10 }}
            />
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              content={({ active, payload, label }: any) => {
                if (!active || !payload?.length) return null;
                const demand = payload.find((p: any) => p.dataKey === "demand")?.value ?? 0;
                const supply = payload.find((p: any) => p.dataKey === "training_supply")?.value ?? 0;
                const gapPct = demand > 0 ? Math.round(((demand - supply) / demand) * 100) : 0;
                return (
                  <div className="rounded-lg border border-slate-700 bg-slate-950/95 px-3 py-2.5 shadow-xl">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400 mb-1.5">{label}</p>
                    <div className="space-y-1 text-[11px]">
                      <div className="flex justify-between gap-4">
                        <span className="text-blue-400">Demand</span>
                        <span className="font-mono font-semibold text-slate-100">{demand.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-emerald-400">Training supply</span>
                        <span className="font-mono font-semibold text-slate-100">{supply.toLocaleString()}</span>
                      </div>
                      {gapPct > 0 && (
                        <div className="flex justify-between gap-4 border-t border-slate-700 pt-1 mt-1">
                          <span className={gapPct > 50 ? "text-red-400 font-medium" : "text-amber-400"}>Gap</span>
                          <span className={`font-mono font-semibold ${gapPct > 50 ? "text-red-400" : "text-amber-400"}`}>{gapPct}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }}
            />
            <Legend
              verticalAlign="top"
              height={24}
              iconSize={8}
              wrapperStyle={{ fontSize: 10 }}
            />
            <Bar
              dataKey="demand"
              name="Job demand"
              fill="url(#demandBarGrad)"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="training_supply"
              name="Training capacity"
              fill="url(#supplyBarGrad)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

