"use client";

import { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import {
  INDUSTRY_COLORS,
  INDUSTRY_LABELS,
  CHART_TOOLTIP_STYLE,
} from "../../lib/chart-constants";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const INDUSTRY_KEYS = [
  "government",
  "defense",
  "healthcare",
  "manufacturing",
  "technology",
  "education",
  "public_safety",
] as const;

type IndustryKey = (typeof INDUSTRY_KEYS)[number];

const SERIES: { key: IndustryKey; label: string; stroke: string }[] =
  INDUSTRY_KEYS.map((k) => ({
    key: k,
    label: INDUSTRY_LABELS[k] ?? k,
    stroke: INDUSTRY_COLORS[k] ?? "#94a3b8",
  }));

/* ------------------------------------------------------------------ */
/*  Custom tooltip                                                     */
/* ------------------------------------------------------------------ */

const CustomHiringTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const total = payload.reduce(
    (sum: number, p: any) => sum + (p.value ?? 0),
    0
  );
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-950/95 px-3 py-2.5 shadow-xl backdrop-blur-sm">
      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400 mb-2">
        {shortDate(label)}
      </p>
      {payload
        .filter((p: any) => p.value != null && p.value > 0)
        .sort((a: any, b: any) => (b.value ?? 0) - (a.value ?? 0))
        .map((p: any) => {
          const rawKey = String(p.dataKey).replace(/_actual$|_proj$/, "");
          return (
            <div
              key={p.dataKey}
              className="flex items-center justify-between gap-4 text-[11px] py-0.5"
            >
              <span className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: p.stroke }}
                />
                <span className="text-slate-300">
                  {INDUSTRY_LABELS[rawKey] ?? rawKey}
                </span>
              </span>
              <span className="font-mono font-semibold text-slate-100 tabular-nums">
                {(p.value as number).toLocaleString()}
              </span>
            </div>
          );
        })}
      <div className="mt-2 border-t border-slate-700 pt-1.5 flex justify-between text-[11px]">
        <span className="text-slate-400 font-medium">Total</span>
        <span className="font-mono font-bold text-slate-50 tabular-nums">
          {total.toLocaleString()}
        </span>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Format ISO date "2025-12-20" → "Dec 20" */
function shortDate(isoDate: string): string {
  if (!isoDate || isoDate.startsWith("P+")) return isoDate;
  try {
    const d = new Date(isoDate + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return isoDate;
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function HiringTrendsChart({
  data,
  highlight = null,
  rangeLabel = "Last 90 days",
  demoMode = false,
}: HiringTrendsChartProps) {
  const [hidden, setHidden] = useState<Record<string, boolean>>({});

  const toggleSeries = (key: string) => {
    setHidden((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  /* ---------- chart data (with optional 26-week projection) ---------- */

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
      const point: Record<string, any> = { date: `P+${i}w` };
      for (const k of INDUSTRY_KEYS) {
        point[`${k}_actual`] = null;
        point[`${k}_proj`] = Math.round((last[k] ?? 0) * factor);
      }
      projected.push(point);
    }

    const base = (data ?? []).map((p) => {
      const point: Record<string, any> = { date: p.date };
      for (const k of INDUSTRY_KEYS) {
        point[`${k}_actual`] = p[k];
        point[`${k}_proj`] = null;
      }
      return point;
    });

    return [...base, ...projected];
  }, [demoMode, data]);

  /* ---------- reference line label (last real date) ---------- */

  const lastRealDate = useMemo(() => {
    if (!demoMode || data.length === 0) return null;
    return data[data.length - 1].date;
  }, [demoMode, data]);

  /* ---------- insight: fastest growing & declining ---------- */

  const insight = useMemo(() => {
    if (data.length < 2) return null;
    const first = data[0];
    const last = data[data.length - 1];

    let bestKey: IndustryKey = INDUSTRY_KEYS[0];
    let bestPct = -Infinity;
    let worstKey: IndustryKey = INDUSTRY_KEYS[0];
    let worstPct = Infinity;

    for (const k of INDUSTRY_KEYS) {
      const start = first[k] || 1;
      const end = last[k] || 0;
      const pct = ((end - start) / start) * 100;
      if (pct > bestPct) {
        bestPct = pct;
        bestKey = k;
      }
      if (pct < worstPct) {
        worstPct = pct;
        worstKey = k;
      }
    }

    return {
      growing: INDUSTRY_LABELS[bestKey] ?? bestKey,
      growingPct: bestPct,
      declining: INDUSTRY_LABELS[worstKey] ?? worstKey,
      decliningPct: worstPct,
    };
  }, [data]);

  /* ---------- dim helper ---------- */

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
      opacity: isHighlighted && !isThis ? 0.25 : 1,
      fillOpacity: isHighlighted && !isThis ? 0.08 : 0.55,
    };
  };

  /* ---------- render ---------- */

  if (data.length === 1) {
    const point = data[0];
    const industryData = SERIES.map((s) => ({
      label: s.label,
      color: s.stroke,
      value: (point as unknown as Record<string, number>)[s.key] ?? 0,
    }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

    return (
      <Card className="overflow-hidden border-slate-800/80 bg-gradient-to-br from-slate-950 via-slate-950 to-sky-950/20 shadow-xl">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <TrendingUp className="h-4 w-4 text-sky-400" />
              Sector Hiring Snapshot — {point.date}
            </CardTitle>
            <span className="text-[10px] text-slate-500">{rangeLabel}</span>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-[11px] text-slate-400">
            Snapshot from a single collection cycle — showing classified positions by sector.
            Multi-week trend analysis requires additional pipeline runs.
          </p>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={industryData} layout="vertical" margin={{ left: 100, right: 30, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#0f172a" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} axisLine={false} />
                <YAxis dataKey="label" type="category" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} width={95} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                  {industryData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-[480px] shadow-lg shadow-slate-900/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl">
      <CardHeader>
        <div className="flex items-center justify-between w-full">
          <CardTitle>
            Sector Hiring Velocity &mdash; Decision Intelligence
          </CardTitle>
          <span className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
            {rangeLabel}
          </span>
        </div>
      </CardHeader>

      {/* ---------- insight callout ---------- */}
      {insight && (
        <div className="mx-6 mb-2 flex items-center gap-2 rounded-md border border-sky-900/40 bg-sky-950/30 px-3 py-1.5 text-[11px] text-slate-300">
          <TrendingUp className="h-3.5 w-3.5 shrink-0 text-sky-400" />
          <span>
            <span className="font-medium text-sky-300">{insight.growing}</span>{" "}
            is the fastest-growing sector
            <span className="text-slate-500">
              {" "}
              ({insight.growingPct >= 0 ? "+" : ""}
              {insight.growingPct.toFixed(1)}%)
            </span>
            {insight.declining !== insight.growing && (
              <>
                {" "}
                &middot;{" "}
                <span className="font-medium text-amber-300">
                  {insight.declining}
                </span>{" "}
                is declining
                <span className="text-slate-500">
                  {" "}
                  ({insight.decliningPct >= 0 ? "+" : ""}
                  {insight.decliningPct.toFixed(1)}%)
                </span>
              </>
            )}
          </span>
        </div>
      )}

      <CardContent className="h-[380px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ left: 0, right: 20, top: 5, bottom: 5 }}
            stackOffset="none"
          >
            {/* ---------- gradient defs ---------- */}
            <defs>
              {SERIES.map((s) => (
                <linearGradient
                  key={`grad-${s.key}`}
                  id={`grad-${s.key}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor={s.stroke}
                    stopOpacity={0.6}
                  />
                  <stop
                    offset="100%"
                    stopColor={s.stroke}
                    stopOpacity={0.1}
                  />
                </linearGradient>
              ))}
            </defs>

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
              tickFormatter={shortDate}
              interval="preserveStartEnd"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              stroke="#64748b"
              tick={{ fontSize: 10 }}
            />

            <Tooltip
              content={<CustomHiringTooltip />}
              wrapperStyle={{ zIndex: 50 }}
            />

            {/* ---------- legend ---------- */}
            <Legend
              verticalAlign="top"
              height={36}
              iconSize={8}
              wrapperStyle={{ fontSize: 11 }}
              content={() => (
                <div className="grid grid-cols-4 gap-x-4 gap-y-1.5 items-center pt-1">
                  {SERIES.map((s) => {
                    const isOff = hidden[s.key];
                    const isHighlighted = highlight != null;
                    const isDim = isHighlighted && highlight !== s.key;
                    return (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => toggleSeries(String(s.key))}
                        className={`flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] transition-opacity ${
                          isOff
                            ? "opacity-35"
                            : isDim
                              ? "opacity-45"
                              : "opacity-90 hover:opacity-100"
                        }`}
                        title="Toggle series"
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-sm"
                          style={{
                            backgroundColor: s.stroke,
                            boxShadow: isOff
                              ? "none"
                              : `0 0 12px ${s.stroke}33`,
                          }}
                        />
                        <span className="text-slate-300">{s.label}</span>
                      </button>
                    );
                  })}
                  {demoMode && (
                    <span className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                      Projection: 6 months
                    </span>
                  )}
                </div>
              )}
            />

            {/* ---------- reference line at last real data point ---------- */}
            {demoMode && lastRealDate && (
              <ReferenceLine
                x={lastRealDate}
                stroke="#a855f7"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: "Today",
                  position: "insideTopRight",
                  fill: "#a855f7",
                  fontSize: 10,
                  fontWeight: 600,
                }}
              />
            )}

            {/* ---------- area series ---------- */}
            {SERIES.flatMap((s) => {
              const dim = dimIfNot(s.key, s.stroke, 1.5);
              const isHidden = hidden[s.key];
              const actualKey = demoMode ? `${s.key}_actual` : String(s.key);
              const projKey = `${s.key}_proj`;

              const areas = [
                <Area
                  key={`${s.key}-actual`}
                  type="monotone"
                  dataKey={actualKey}
                  stackId="hiring"
                  stroke={dim.stroke}
                  strokeWidth={dim.strokeWidth}
                  fill={`url(#grad-${s.key})`}
                  fillOpacity={dim.fillOpacity}
                  opacity={dim.opacity}
                  dot={false}
                  isAnimationActive
                  animationDuration={450}
                  hide={isHidden}
                />,
              ];

              if (demoMode) {
                areas.push(
                  <Area
                    key={`${s.key}-proj`}
                    type="monotone"
                    dataKey={projKey}
                    stroke={s.stroke}
                    strokeWidth={1.4}
                    strokeDasharray="4 4"
                    fill="none"
                    fillOpacity={0}
                    opacity={isHidden ? 0 : 0.6}
                    dot={false}
                    isAnimationActive
                    animationDuration={700}
                    hide={isHidden}
                  />,
                );
              }

              return areas;
            })}
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
