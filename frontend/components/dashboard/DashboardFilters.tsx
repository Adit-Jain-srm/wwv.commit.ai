import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

interface DashboardFiltersProps {
  industry: string | "all";
  sector: string | "all";
  dateRange: "30d" | "90d" | "12m";
  onIndustryChange: (value: string | "all") => void;
  onSectorChange: (value: string | "all") => void;
  onDateRangeChange: (value: "30d" | "90d" | "12m") => void;
}

const industryOptions = [
  "All industries",
  "Government",
  "Defense",
  "Healthcare",
  "Manufacturing",
  "Technology",
  "Education",
  "Public Safety"
];

const sectorOptions = ["All sectors", "Public", "Private", "Federal"];

export function DashboardFilters({
  industry,
  sector,
  dateRange,
  onIndustryChange,
  onSectorChange,
  onDateRangeChange
}: DashboardFiltersProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
        <span className="uppercase tracking-[0.16em] text-slate-500">
          Focus
        </span>
        <div className="flex items-center gap-1.5">
          <SelectLike
            value={industry}
            options={industryOptions}
            onChange={onIndustryChange}
          />
          <SelectLike
            value={sector}
            options={sectorOptions}
            onChange={onSectorChange}
          />
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-[11px]">
        <span className="uppercase tracking-[0.16em] text-slate-500">
          Window
        </span>
        <SegmentedControl
          value={dateRange}
          onChange={onDateRangeChange}
          options={[
            { value: "30d", label: "30d" },
            { value: "90d", label: "90d" },
            { value: "12m", label: "12m" }
          ]}
        />
      </div>
    </div>
  );
}

interface SelectLikeProps {
  value: string | "all";
  options: string[];
  onChange: (value: string | "all") => void;
}

function SelectLike({ value, options, onChange }: SelectLikeProps) {
  return (
    <div className="relative">
      <select
        className={cn(
          "h-7 appearance-none rounded-md border border-slate-800/80 bg-slate-950/80 px-2.5 pr-6 text-[11px] font-medium",
          "text-slate-200 focus:border-sky-500/70 focus:outline-none focus:ring-1 focus:ring-sky-500/70"
        )}
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "all" ? "all" : v);
        }}
      >
        {options.map((option) => {
          const normalized =
            option === "All industries" || option === "All sectors"
              ? "all"
              : option;
          return (
            <option key={option} value={normalized}>
              {option}
            </option>
          );
        })}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-500" />
    </div>
  );
}

interface SegmentedControlProps<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}

function SegmentedControl<T extends string>({
  value,
  options,
  onChange
}: SegmentedControlProps<T>) {
  return (
    <div className="inline-flex rounded-md border border-slate-800/80 bg-slate-950/80 p-0.5">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-[3px] px-2.5 py-0.5 text-[10px] font-medium transition-colors",
              active
                ? "bg-sky-600 text-slate-50"
                : "text-slate-400 hover:bg-slate-800/80 hover:text-slate-100"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

