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
import { INDUSTRY_COLORS, INDUSTRY_LABELS, CHART_TOOLTIP_STYLE, PROJECTION_FACTOR as PROJ_FACTOR } from "../../lib/chart-constants";

export type IndustryBarDatum = {
  industry: string;
  postings: number;
};

interface IndustryBreakdownChartProps {
  data: IndustryBarDatum[];
  demoMode?: boolean;
}

const IndustryBarShape = (props: any) => {
  const { x, y, width, height, payload } = props;
  const key = Object.entries(INDUSTRY_LABELS).find(
    ([, label]) => label === payload?.industry
  )?.[0];
  const color = key ? (INDUSTRY_COLORS[key] ?? "#22c55e") : "#22c55e";
  return <rect x={x} y={y} width={width} height={height} rx={4} fill={color} fillOpacity={0.8} />;
};

export function IndustryBreakdownChart({
  data,
  demoMode = false
}: IndustryBreakdownChartProps) {
  const chartData = demoMode
    ? data.map((d) => {
        const proj = Math.round(d.postings * PROJ_FACTOR);
        return { ...d, postings_proj: proj, postings_delta: Math.max(0, proj - d.postings) };
      })
    : data;

  return (
    <Card className="h-[340px] shadow-lg shadow-slate-900/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Sector Employment Share — Resource Allocation Guide</CardTitle>
        {demoMode && (
          <span className="text-[10px] uppercase tracking-[0.16em] text-emerald-400/90">
            6mo projection
          </span>
        )}
      </CardHeader>
      <CardContent className="h-[260px]">
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
              contentStyle={CHART_TOOLTIP_STYLE}
            />
            <Bar
              dataKey="postings"
              stackId="industry"
              shape={<IndustryBarShape />}
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
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

