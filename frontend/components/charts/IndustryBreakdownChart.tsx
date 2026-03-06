"use client";

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

export type IndustryBarDatum = {
  industry: string;
  postings: number;
};

interface IndustryBreakdownChartProps {
  data: IndustryBarDatum[];
  demoMode?: boolean;
}

const PROJECTION_FACTOR = 1.14;

export function IndustryBreakdownChart({
  data,
  demoMode = false
}: IndustryBreakdownChartProps) {
  const chartData = demoMode
    ? data.map((d) => {
        const proj = Math.round(d.postings * PROJECTION_FACTOR);
        return { ...d, postings_proj: proj, postings_delta: Math.max(0, proj - d.postings) };
      })
    : data;

  return (
    <Card className="h-[300px] shadow-lg shadow-slate-900/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Top hiring sectors — volume</CardTitle>
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
            layout="vertical"
            margin={{ left: 60, right: 10, top: 5, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#0f172a"
              horizontal={false}
            />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              stroke="#64748b"
              tick={{ fontSize: 10 }}
            />
            <YAxis
              dataKey="industry"
              type="category"
              tickLine={false}
              axisLine={false}
              stroke="#64748b"
              tick={{ fontSize: 10 }}
              width={120}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#020617",
                border: "1px solid #1f2937",
                borderRadius: 8,
                fontSize: 11
              }}
            />
            <Bar
              dataKey="postings"
              stackId="industry"
              radius={[4, demoMode ? 0 : 4, demoMode ? 0 : 4, 4]}
              fill="url(#industryVolumeGradient)"
              isAnimationActive
              animationDuration={400}
            />
            {demoMode && (
              <Bar
                dataKey="postings_delta"
                stackId="industry"
                radius={[0, 4, 4, 0]}
                fill="#22c55e"
                fillOpacity={0.35}
                stroke="#22c55e"
                strokeWidth={1}
                strokeDasharray="3 2"
                isAnimationActive
                animationDuration={700}
                animationEasing="ease-out"
              />
            )}
            <defs>
              <linearGradient
                id="industryVolumeGradient"
                x1="0"
                y1="0"
                x2="1"
                y2="0"
              >
                <stop offset="0%" stopColor="#22c55e" />
                <stop offset="60%" stopColor="#2563eb" />
                <stop offset="100%" stopColor="#a855f7" />
              </linearGradient>
            </defs>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

