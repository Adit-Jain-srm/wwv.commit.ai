"use client";

import type { ReactNode } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

export type SkillDemandDatum = {
  skill: string;
  postings: number;
};

interface SkillsDemandChartProps {
  data: SkillDemandDatum[];
  demoMode?: boolean;
}

const PROJECTION_FACTOR = 1.14;

export function SkillsDemandChart({ data, demoMode = false }: SkillsDemandChartProps) {
  const chartData = demoMode
    ? data.map((d) => ({ ...d, postings: Math.round(d.postings * PROJECTION_FACTOR) }))
    : data;

  return (
    <Card className="h-[300px] shadow-lg shadow-slate-900/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Top skills in job descriptions</CardTitle>
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
              contentStyle={{
                backgroundColor: "#020617",
                border: "1px solid #1f2937",
                borderRadius: 8,
                fontSize: 11
              }}
            />
            <Bar
              dataKey="postings"
              radius={[4, 4, 0, 0]}
              fill="#22c55e"
              isAnimationActive
              animationDuration={demoMode ? 700 : 400}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

