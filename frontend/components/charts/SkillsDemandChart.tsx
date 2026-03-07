"use client";

import type { ReactNode } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { CHART_TOOLTIP_STYLE, PROJECTION_FACTOR as PROJ_FACTOR } from "../../lib/chart-constants";

export type SkillDemandDatum = {
  skill: string;
  postings: number;
};

interface SkillsDemandChartProps {
  data: SkillDemandDatum[];
  demoMode?: boolean;
}

export function SkillsDemandChart({ data, demoMode = false }: SkillsDemandChartProps) {
  const chartData = demoMode
    ? data.map((d) => ({ ...d, postings: Math.round(d.postings * PROJ_FACTOR) }))
    : data;

  const avg = chartData.length > 0 ? Math.round(chartData.reduce((s, d) => s + d.postings, 0) / chartData.length) : 0;

  return (
    <Card className="h-[300px] shadow-lg shadow-slate-900/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Critical Skills Demand — Training Investment Priorities</CardTitle>
        {demoMode && (
          <span className="text-[10px] uppercase tracking-[0.16em] text-emerald-400/90">
            6mo projection
          </span>
        )}
      </CardHeader>
      <CardContent className="h-[230px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ left: 0, right: 10, top: 5, bottom: 20 }}
          >
            <defs>
              <linearGradient id="skillsBarGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#2563eb" stopOpacity={0.7} />
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
              formatter={(value): [ReactNode, string] => {
                const v =
                  typeof value === "number"
                    ? value.toLocaleString()
                    : String(value);
                return [`${v} postings`, "Demand"];
              }}
              contentStyle={CHART_TOOLTIP_STYLE}
            />
            {avg > 0 && (
              <ReferenceLine y={avg} stroke="#64748b" strokeDasharray="3 3" label={{ value: `Avg: ${avg}`, position: "right", fill: "#64748b", fontSize: 10 }} />
            )}
            <Bar
              dataKey="postings"
              radius={[4, 4, 0, 0]}
              fill="url(#skillsBarGradient)"
              isAnimationActive
              animationDuration={demoMode ? 700 : 400}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

