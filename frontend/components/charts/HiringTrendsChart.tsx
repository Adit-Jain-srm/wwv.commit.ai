"use client";

import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

export type HiringTimeseriesPoint = {
  date: string;
  government: number;
  defense: number;
  healthcare: number;
  manufacturing: number;
  technology: number;
  education: number;
  public_safety: number;
};

interface HiringTrendsChartProps {
  data: HiringTimeseriesPoint[];
  highlight?: keyof Omit<HiringTimeseriesPoint, "date"> | null;
  rangeLabel?: string;
  demoMode?: boolean;
}

export function HiringTrendsChart({
  data,
  highlight = null,
  rangeLabel = "Last 90 days",
  demoMode = false
}: HiringTrendsChartProps) {
  const SERIES: {
    key: keyof Omit<HiringTimeseriesPoint, "date">;
    label: string;
    stroke: string;
  }[] = [
    { key: "government", label: "Government", stroke: "#38bdf8" },
    { key: "defense", label: "Defense", stroke: "#e5e7eb" },
    { key: "healthcare", label: "Healthcare", stroke: "#22c55e" },
    { key: "manufacturing", label: "Manufacturing", stroke: "#f97316" },
    { key: "technology", label: "Technology", stroke: "#a855f7" },
    { key: "education", label: "Education", stroke: "#facc15" },
    { key: "public_safety", label: "Public Safety", stroke: "#f97373" }
  ];

  const [hidden, setHidden] = useState<Record<string, boolean>>({});

  const toggleSeries = (key: string) => {
    setHidden((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const chartData = useMemo(() => {
    if (!demoMode || data.length < 2) return data as any[];

    const last = data[data.length - 1];
    const lastDate = new Date(last.date);
    const projectedWeeks = 26;
    const growth = 0.14; // +14% over projection window

    const projected: any[] = [];
    for (let i = 1; i <= projectedWeeks; i += 1) {
      const d = new Date(lastDate);
      d.setDate(d.getDate() + i * 7);
      const t = i / projectedWeeks;
      const factor = 1 + growth * t;
      projected.push({
        date: `P+${i}w`,
        government_actual: null,
        defense_actual: null,
        healthcare_actual: null,
        manufacturing_actual: null,
        technology_actual: null,
        education_actual: null,
        public_safety_actual: null,
        government_proj: Math.round((last.government ?? 0) * factor),
        defense_proj: Math.round((last.defense ?? 0) * factor),
        healthcare_proj: Math.round((last.healthcare ?? 0) * factor),
        manufacturing_proj: Math.round((last.manufacturing ?? 0) * factor),
        technology_proj: Math.round((last.technology ?? 0) * factor),
        education_proj: Math.round((last.education ?? 0) * factor),
        public_safety_proj: Math.round((last.public_safety ?? 0) * factor)
      });
    }

    const base = (data ?? []).map((p) => ({
      date: p.date,
      government_actual: p.government,
      defense_actual: p.defense,
      healthcare_actual: p.healthcare,
      manufacturing_actual: p.manufacturing,
      technology_actual: p.technology,
      education_actual: p.education,
      public_safety_actual: p.public_safety,
      government_proj: null,
      defense_proj: null,
      healthcare_proj: null,
      manufacturing_proj: null,
      technology_proj: null,
      education_proj: null,
      public_safety_proj: null
    }));

    return [...base, ...projected];
  }, [demoMode, data]);

  const dimIfNot = (
    key: keyof Omit<HiringTimeseriesPoint, "date">,
    stroke: string,
    width: number
  ) => {
    const isHighlighted = highlight != null;
    const isThis = highlight === key;
    return {
      stroke: isHighlighted && !isThis ? `${stroke}80` : stroke,
      strokeWidth: isHighlighted && isThis ? Math.max(width, 2) : width,
      opacity: isHighlighted && !isThis ? 0.25 : 1
    };
  };

  return (
    <Card className="h-[360px] shadow-lg shadow-slate-900/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl">
      <CardHeader>
        <div className="flex items-center justify-between w-full">
          <CardTitle>Hiring trends — postings by industry</CardTitle>
          <span className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
            {rangeLabel}
          </span>
        </div>
      </CardHeader>
      <CardContent className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ left: -20, right: 10, top: 5 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#0f172a"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tickLine={false}
              stroke="#64748b"
              tickMargin={8}
              tick={{ fontSize: 10 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              stroke="#64748b"
              tick={{ fontSize: 10 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#020617",
                border: "1px solid #1f2937",
                borderRadius: 8,
                fontSize: 11
              }}
            />
            <Legend
              verticalAlign="top"
              height={24}
              iconSize={8}
              wrapperStyle={{ fontSize: 10 }}
              content={() => (
                <div className="flex flex-wrap gap-x-3 gap-y-1 items-center pt-1">
                  {SERIES.map((s) => {
                    const isOff = hidden[s.key];
                    const isHighlighted = highlight != null;
                    const isDim = isHighlighted && highlight !== s.key;
                    return (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => toggleSeries(String(s.key))}
                        className={`flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] transition-opacity ${
                          isOff ? "opacity-35" : isDim ? "opacity-45" : "opacity-90 hover:opacity-100"
                        }`}
                        title="Toggle series"
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-sm"
                          style={{
                            backgroundColor: s.stroke,
                            boxShadow: isOff ? "none" : `0 0 12px ${s.stroke}33`
                          }}
                        />
                        <span className="text-slate-300">{s.label}</span>
                      </button>
                    );
                  })}
                  {demoMode && (
                    <span className="ml-auto text-[10px] uppercase tracking-[0.16em] text-slate-500">
                      Projection: 6 months
                    </span>
                  )}
                </div>
              )}
            />
            {SERIES.map((s) => {
              const dim = dimIfNot(s.key, s.stroke, 1.5);
              const isHidden = hidden[s.key];
              const actualKey = demoMode ? `${s.key}_actual` : String(s.key);
              const projKey = `${s.key}_proj`;

              return (
                <g key={s.key as string}>
                  <Line
                    type="monotone"
                    dataKey={actualKey}
                    stroke={dim.stroke}
                    strokeWidth={dim.strokeWidth}
                    opacity={dim.opacity}
                    dot={false}
                    isAnimationActive
                    animationDuration={450}
                    hide={isHidden}
                  />
                  {demoMode && (
                    <Line
                      type="monotone"
                      dataKey={projKey}
                      stroke={s.stroke}
                      strokeWidth={1.4}
                      strokeDasharray="4 4"
                      opacity={isHidden ? 0 : 0.6}
                      dot={false}
                      isAnimationActive
                      animationDuration={700}
                      hide={isHidden}
                    />
                  )}
                </g>
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

