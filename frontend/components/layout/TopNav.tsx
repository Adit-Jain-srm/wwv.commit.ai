import { useRef, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { useSearch } from "../../lib/SearchContext";
import { UserMenu } from "../UserMenu";

interface TopNavProps {
  searchSuggestions?: { type: string; name: string }[];
  onExportPdf?: () => void;
  exportLoading?: boolean;
}

export function TopNav({
  searchSuggestions = [],
  onExportPdf,
  exportLoading = false
}: TopNavProps) {
  const { query, setQuery, setActiveSuggestion, setFilters } = useSearch();
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = query.trim().length > 0
    ? searchSuggestions.filter(
        (s) =>
          s.name.toLowerCase().includes(query.toLowerCase()) ||
          s.type.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  const handleSelect = (name: string) => {
    setQuery(name);
    setActiveSuggestion(name);
    setFilters({
      industry: matches.find((m) => m.name === name && m.type === "industry")?.name ?? null,
      skill: matches.find((m) => m.name === name && m.type === "skill")?.name ?? null,
      neighborhood: matches.find((m) => m.name === name && m.type === "neighborhood")?.name ?? null,
    });
    setFocused(false);
    inputRef.current?.blur();
  };

  return (
    <header className="print:hidden border-b border-slate-900/80 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto max-w-[1600px] px-2 lg:px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-sky-500 via-emerald-400 to-sky-700 shadow-lg shadow-sky-900/50" />
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                Workforce Pulse
              </span>
              <Badge variant="success">Live beta</Badge>
            </div>
            <div className="flex items-center gap-2 text-[13px] text-slate-300">
              <span className="font-semibold text-slate-100">
                Montgomery, Alabama
              </span>
              <span className="h-1 w-1 rounded-full bg-emerald-400" />
              <span className="text-slate-400">Workforce & economic signal board</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden lg:block">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  const v = e.target.value;
                  setQuery(v);
                  setActiveSuggestion(null);
                  const q = v.trim().toLowerCase();
                  const industryLabels = ["Government", "Defense", "Healthcare", "Manufacturing", "Technology", "Education", "Public Safety"];
                  const industry = industryLabels.find((x) => x.toLowerCase().includes(q) || q.includes(x.toLowerCase())) ?? null;
                  setFilters({
                    industry,
                    skill: q.length >= 2 ? (q.includes("python") ? "Python" : q.includes("cyber") ? "Cybersecurity" : q.includes("nurs") ? "Nursing" : null) : null,
                    neighborhood: q.length >= 2 ? (q.includes("downtown") ? "Downtown Montgomery" : q.includes("east") ? "East Montgomery" : q.includes("maxwell") ? "Maxwell / Gunter Area" : null) : null,
                  });
                }}
                onFocus={() => setFocused(true)}
                onBlur={() => setTimeout(() => setFocused(false), 180)}
                placeholder="Intelligence search — industries, skills, neighborhoods"
                className={cn(
                  "h-9 w-80 min-w-[18rem] xl:w-96 xl:min-w-[22rem] rounded-md border border-slate-800/80 bg-slate-900/70 pl-8 pr-2 text-[15px]",
                  "placeholder:text-slate-500 focus:border-sky-500/70 focus:outline-none focus:ring-1 focus:ring-sky-500/70"
                )}
              />
              {focused && matches.length > 0 && (
                <div
                  className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-auto rounded-md border border-slate-700 bg-slate-900 py-1 shadow-xl"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  {matches.slice(0, 8).map((s, i) => (
                    <button
                      key={`${s.type}-${s.name}-${i}`}
                      type="button"
                      onClick={() => handleSelect(s.name)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[14px] text-slate-200 hover:bg-slate-800"
                    >
                      <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] uppercase text-slate-400">
                        {s.type}
                      </span>
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <Button
            variant="subtle"
            size="sm"
            className="hidden md:inline-flex gap-1.5 text-[12px]"
            onClick={onExportPdf ?? (() => typeof window !== "undefined" && window.print())}
            disabled={exportLoading}
          >
            {exportLoading ? (
              <span className="animate-pulse">Generating report…</span>
            ) : (
              <>
                <span className="uppercase tracking-[0.16em]">Export</span>
                <span className="text-slate-300/80">PDF</span>
              </>
            )}
          </Button>

          <UserMenu name="Montgomery Planner" />
        </div>
      </div>
    </header>
  );
}

