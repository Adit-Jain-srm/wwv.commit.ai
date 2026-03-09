"use client";

import { useMemo, useState } from "react";
import { useDashboardData } from "../../../lib/DashboardDataContext";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";
import { TrendingUp, Building2, Zap, FileText, ChevronDown, ChevronRight } from "lucide-react";

const EVENT_ICONS: Record<string, React.ElementType> = {
  defense: TrendingUp,
  defense_contract: TrendingUp,
  company_profile: Building2,
  expansion: TrendingUp,
  new_business: Building2,
  business: Building2,
  data_center: Zap,
  permit: FileText,
  serp: FileText,
  general: FileText,
};

const TYPE_LABELS: Record<string, string> = {
  defense: "Defense",
  defense_contract: "Defense Contract",
  company_profile: "Company Profile",
  expansion: "Expansion",
  new_business: "New Business",
  business: "Business",
  data_center: "Data Center",
  permit: "Permit",
  serp: "Search Signal",
  general: "General",
};

type TimelineEvent = {
  date: string;
  label: string;
  type: string;
  description?: string;
  url?: string;
  host?: string;
};

export default function SignalsPage() {
  const { signals, loading } = useDashboardData();
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const filteredSignals = useMemo(() => {
    return signals?.signals ?? [];
  }, [signals]);

  const apiEvents: TimelineEvent[] = useMemo(
    () =>
      filteredSignals.map(
        (s: {
          title?: string;
          label?: string;
          collected_at?: string;
          signal_type?: string;
          description?: string;
          url?: string;
          source?: string;
        }) => {
          const d = s.collected_at ? new Date(s.collected_at) : new Date();
          const url = typeof s.url === "string" ? s.url : undefined;
          let host: string | undefined;
          if (url) {
            try {
              const parsed = new URL(url);
              host = parsed.hostname.replace(/^www\./, "");
            } catch {
              host = s.source;
            }
          } else if (s.source) {
            host = s.source;
          }

          return {
            date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            label: s.title ?? s.label ?? "Economic signal",
            type: (s.signal_type ?? "general") as string,
            description: s.description,
            url,
            host,
          };
        }
      ) ?? [],
    [filteredSignals]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    for (const evt of apiEvents) {
      const group = map.get(evt.type) ?? [];
      group.push(evt);
      map.set(evt.type, group);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [apiEvents]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const evt of apiEvents) {
      counts[evt.type] = (counts[evt.type] ?? 0) + 1;
    }
    return counts;
  }, [apiEvents]);

  const toggleGroup = (type: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] gap-3 px-3 py-4 laptop:px-4 desktop:px-6">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-slate-100">Economic Activity Timeline</h1>
          {apiEvents.length > 0 && (
            <span className="rounded-full bg-sky-900/60 px-2.5 py-0.5 text-[11px] font-medium text-sky-300">
              {apiEvents.length} signal{apiEvents.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <p className="text-sm text-slate-400">
          Recent business signals and economic activity in Montgomery.
        </p>
      </div>

      {/* Type badges */}
      {apiEvents.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {Object.entries(typeCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([type, count]) => {
              const Icon = EVENT_ICONS[type] ?? FileText;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleGroup(type)}
                  className="flex items-center gap-1.5 rounded-md border border-slate-800/80 bg-slate-950/50 px-2.5 py-1.5 text-[11px] text-slate-300 hover:border-sky-700 hover:text-sky-200 transition-colors"
                >
                  <Icon className="h-3 w-3 text-sky-400" />
                  <span>{TYPE_LABELS[type] ?? type}</span>
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-400">
                    {count}
                  </span>
                </button>
              );
            })}
        </div>
      )}

      {loading ? (
        <Skeleton className="h-[320px] w-full rounded-lg bg-slate-900/80" />
      ) : apiEvents.length === 0 ? (
        <Card className="border-slate-800/80">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Zap className="mb-3 h-8 w-8 text-slate-600" />
            <p className="text-sm font-medium text-slate-400">No economic signals yet</p>
            <p className="mt-1 text-xs text-slate-600">
              Run the data pipeline to collect business signals, permits, and economic activity.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {grouped.map(([type, events]) => {
            const Icon = EVENT_ICONS[type] ?? FileText;
            const isCollapsed = collapsedGroups.has(type);
            return (
              <Card key={type} className="border-slate-800/80 shadow-lg">
                <CardHeader className="pb-2">
                  <button
                    type="button"
                    onClick={() => toggleGroup(type)}
                    className="flex w-full items-center justify-between"
                  >
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                      <Icon className="h-4 w-4 text-sky-400" />
                      {TYPE_LABELS[type] ?? type}
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-400">
                        {events.length}
                      </span>
                    </CardTitle>
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4 text-slate-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-500" />
                    )}
                  </button>
                </CardHeader>
                {!isCollapsed && (
                  <CardContent>
                    <div className="space-y-2">
                      {events.map((evt, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-3 rounded-lg border border-slate-800/80 bg-slate-950/50 px-3 py-2.5"
                        >
                          <span className="text-[11px] font-mono text-slate-500 shrink-0">
                            {evt.date}
                          </span>
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="text-sm text-slate-200">
                              {evt.label}
                            </div>
                            {(evt.description || evt.url || evt.host) && (
                              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                                {evt.description && (
                                  <span className="line-clamp-2">
                                    {evt.description}
                                  </span>
                                )}
                                {evt.url && (
                                  <a
                                    href={evt.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="shrink-0 text-sky-400 hover:text-sky-300 underline-offset-2 hover:underline"
                                  >
                                    {evt.host ?? "Open link"}
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
