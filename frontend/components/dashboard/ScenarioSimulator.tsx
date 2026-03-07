"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Sparkles, Zap } from "lucide-react";
import { useDemoMode } from "../../lib/DemoModeContext";
import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, ReferenceLine } from "recharts";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const PRESETS = [
  "What happens if a new data center opens?",
  "What if defense contracts increase by 20%?",
  "Impact of a new manufacturing plant in Montgomery.",
];

type Projected = Record<string, string>;

interface ScenarioSimulatorProps {
  initialScenario?: string;
  autoRun?: boolean;
}

export function ScenarioSimulator({ initialScenario, autoRun }: ScenarioSimulatorProps) {
  const demo = useDemoMode();
  const [scenario, setScenario] = useState(initialScenario ?? PRESETS[0]);
  const [result, setResult] = useState<{
    scenario: string;
    projected: Projected;
    footnote?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (text?: string) => {
    const toRun = text ?? scenario;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`${API_BASE}/api/scenario`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: toRun.trim() || PRESETS[0] }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.detail || `Request failed (${res.status})`);
        setLoading(false);
        return;
      }

      setResult({
        scenario: data.scenario ?? toRun,
        projected: data.projected ?? {},
        footnote: data.footnote,
      });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Backend unreachable. Start the API."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialScenario && autoRun) {
      setScenario(initialScenario);
      run(initialScenario);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialScenario, autoRun]);

  const projected = result?.projected ?? {};
  const entries = Object.entries(projected).filter(
    ([k]) =>
      !k.startsWith("_") &&
      typeof projected[k] === "string" &&
      projected[k].length > 0
  );

  const chartEntries = useMemo(() => {
    if (!result?.projected) return [];
    return Object.entries(result.projected)
      .filter(([k, v]) => !k.startsWith("_") && typeof v === "string" && v.length > 0)
      .map(([key, value]) => {
        const numMatch = value.match(/([+-]?\d+\.?\d*)/);
        const numValue = numMatch ? parseFloat(numMatch[1]) : 0;
        const isNeg = value.startsWith("-");
        return {
          label: key.replace(/_/g, " "),
          value: isNeg ? -Math.abs(numValue) : numValue,
          displayValue: value,
          isPositive: !isNeg && numValue > 0,
        };
      })
      .filter((e) => e.value !== 0);
  }, [result]);

  return (
    <Card className="border-violet-900/50 bg-slate-950/80 shadow-lg shadow-slate-900/20 transition-shadow hover:shadow-slate-900/30">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <Zap className="h-4 w-4 text-violet-400" />
              Workforce Digital Twin — Scenario Modeling
            </CardTitle>
            <span className="text-[9px] uppercase tracking-widest text-violet-400/60 bg-violet-950/40 px-2 py-0.5 rounded-full border border-violet-800/30">AI-Powered</span>
            <p className="text-[11px] text-slate-500">
              Model workforce impact before committing resources. AI-powered projections for Montgomery.
            </p>
          </div>
          <button
            type="button"
            onClick={() => (demo.enabled ? demo.stop() : demo.start())}
            className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors ${
              demo.enabled
                ? "bg-emerald-600/90 text-slate-50 hover:bg-emerald-500"
                : "bg-slate-800/80 text-slate-200 hover:bg-slate-800"
            }`}
            title="Demo mode animates 6-month projections"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {demo.enabled ? "Demo running" : "Simulate Future Growth"}
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-wider text-slate-500">
            What happens if…
          </label>
          <textarea
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            rows={2}
            placeholder={PRESETS[0]}
            className="w-full resize-none rounded-md border border-slate-700 bg-slate-900/80 px-2.5 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:border-violet-600 focus:outline-none focus:ring-1 focus:ring-violet-600"
          />
          <div className="flex flex-wrap gap-1">
            {PRESETS.map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setScenario(p)}
                className="rounded border border-slate-700 bg-slate-800/50 px-2 py-1 text-[10px] text-slate-400 hover:border-violet-700 hover:text-violet-300"
              >
                {p.split(" ").slice(0, 3).join(" ")}…
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => run()}
          disabled={loading}
          className="w-full rounded-md bg-violet-600 py-2 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {loading ? "Running…" : "Run Digital Twin Projection"}
        </button>

        {result && (
          <div className="rounded-lg border border-violet-900/30 bg-violet-950/20 p-3 space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-violet-400/80">
              Projected impact
            </p>
            <ul className="space-y-1.5">
              {entries.map(([key, value]) => {
                const isPositive = value.startsWith("+");
                const isNegative = value.startsWith("-");
                return (
                  <li
                    key={key}
                    className="flex items-center justify-between gap-2 text-[11px]"
                  >
                    <span className="text-slate-400 capitalize">
                      {key.replace(/_/g, " ")}
                    </span>
                    <span
                      className={`font-semibold tabular-nums ${
                        isPositive
                          ? "text-emerald-400"
                          : isNegative
                            ? "text-red-400"
                            : "text-slate-200"
                      }`}
                    >
                      {value}
                    </span>
                  </li>
                );
              })}
            </ul>
            {chartEntries.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] uppercase tracking-wider text-violet-400/80 mb-2">
                  Impact Magnitude
                </p>
                <div className="h-[140px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartEntries} layout="vertical" margin={{ left: 90, right: 20, top: 5, bottom: 5 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="label" type="category" tick={{ fontSize: 9, fill: "#94a3b8" }} tickLine={false} axisLine={false} width={85} />
                      <ReferenceLine x={0} stroke="#334155" />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={14}>
                        {chartEntries.map((entry, idx) => (
                          <Cell key={idx} fill={entry.isPositive ? "#22c55e" : "#ef4444"} fillOpacity={0.7} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            {result.footnote && (
              <p className="pt-1 text-[10px] text-slate-500">
                {result.footnote}
              </p>
            )}
          </div>
        )}

        {error && (
          <p className="text-[10px] text-amber-400">{error}</p>
        )}
      </CardContent>
    </Card>
  );
}
