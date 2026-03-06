"use client";

import { useDashboardData } from "../../../lib/DashboardDataContext";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";
import { TrendingUp, Building2, Zap, FileText } from "lucide-react";

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

export default function SignalsPage() {
  const { signals, loading } = useDashboardData();

  const apiEvents =
    signals?.signals?.map(
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
    ) ?? [];

  const placeholderEvents = [
    {
      date: "Mar 5",
      label: "Commercial development permit issued",
      type: "permit",
      description: "New commercial development permit recorded in city system.",
    },
    {
      date: "Mar 4",
      label: "AWS data center signal detected",
      type: "data_center",
      description: "Cloud infrastructure expansion activity near Montgomery.",
    },
    {
      date: "Mar 3",
      label: "4 new businesses registered",
      type: "business",
      description: "Multiple new local businesses filed licenses this week.",
    },
  ];

  const timelineEvents = apiEvents.length > 0 ? apiEvents : placeholderEvents;

  return (
    <div className="mx-auto w-full max-w-[1600px] gap-3 px-3 py-4 laptop:px-4 desktop:px-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-100">Economic Activity Timeline</h1>
        <p className="text-sm text-slate-400">
          Recent business signals and economic activity in Montgomery. Scroll to explore.
        </p>
      </div>
      <Card className="border-slate-800/80 shadow-lg">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-200">
            Event feed
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[320px] w-full rounded-lg bg-slate-900/80" />
          ) : (
            <div className="max-h-[400px] overflow-y-auto space-y-3 pr-2">
              {timelineEvents.map((evt, i) => {
                const Icon = EVENT_ICONS[evt.type] ?? FileText;
                return (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded-lg border border-slate-800/80 bg-slate-950/50 px-3 py-2.5"
                  >
                    <span className="text-[11px] font-mono text-slate-500 shrink-0">
                      {evt.date}
                    </span>
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-sky-900/50">
                      <Icon className="h-3 w-3 text-sky-400" />
                    </span>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="text-sm text-slate-200">
                        {evt.label}
                      </div>
                      {(evt.description || evt.url || evt.host) && (
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                          {evt.description && (
                            <span className="truncate max-w-[260px]">
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
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
