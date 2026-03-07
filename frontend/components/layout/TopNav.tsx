import { useCallback, useRef, useState } from "react";
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
  const [highlightIdx, setHighlightIdx] = useState(-1);
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
    setHighlightIdx(-1);
    inputRef.current?.blur();
  };

  const visibleMatches = matches.slice(0, 8);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!focused || visibleMatches.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIdx((prev) => (prev < visibleMatches.length - 1 ? prev + 1 : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIdx((prev) => (prev > 0 ? prev - 1 : visibleMatches.length - 1));
      } else if (e.key === "Enter" && highlightIdx >= 0) {
        e.preventDefault();
        handleSelect(visibleMatches[highlightIdx].name);
      } else if (e.key === "Escape") {
        setFocused(false);
        setHighlightIdx(-1);
        inputRef.current?.blur();
      }
    },
    [focused, visibleMatches, highlightIdx]
  );

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
                  setHighlightIdx(-1);
                  const q = v.trim().toLowerCase();
                  if (q.length < 2) {
                    setFilters({ industry: null, skill: null, neighborhood: null });
                    return;
                  }
                  const industry = searchSuggestions.find((s) => s.type === "industry" && s.name.toLowerCase().includes(q))?.name ?? null;
                  const skill = searchSuggestions.find((s) => s.type === "skill" && s.name.toLowerCase().includes(q))?.name ?? null;
                  const neighborhood = searchSuggestions.find((s) => s.type === "neighborhood" && s.name.toLowerCase().includes(q))?.name ?? null;
                  setFilters({ industry, skill, neighborhood });
                }}
                onFocus={() => setFocused(true)}
                onBlur={() => setTimeout(() => { setFocused(false); setHighlightIdx(-1); }, 180)}
                onKeyDown={handleKeyDown}
                placeholder="Intelligence search — industries, skills, neighborhoods"
                aria-label="Search industries, skills, and neighborhoods"
                role="combobox"
                aria-expanded={focused && visibleMatches.length > 0}
                aria-autocomplete="list"
                className={cn(
                  "h-9 w-80 min-w-[18rem] xl:w-96 xl:min-w-[22rem] rounded-md border border-slate-800/80 bg-slate-900/70 pl-8 pr-2 text-[15px]",
                  "placeholder:text-slate-500 focus:border-sky-500/70 focus:outline-none focus:ring-1 focus:ring-sky-500/70"
                )}
              />
              {focused && visibleMatches.length > 0 && (
                <div
                  className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-auto rounded-md border border-slate-700 bg-slate-900 py-1 shadow-xl"
                  role="listbox"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  {visibleMatches.map((s, i) => (
                    <button
                      key={`${s.type}-${s.name}-${i}`}
                      type="button"
                      role="option"
                      aria-selected={i === highlightIdx}
                      onClick={() => handleSelect(s.name)}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-2 text-left text-[14px] text-slate-200 hover:bg-slate-800",
                        i === highlightIdx && "bg-slate-800"
                      )}
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

          <UserMenu name="City Planner" />
        </div>
      </div>
    </header>
  );
}

