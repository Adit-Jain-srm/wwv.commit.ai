import Link from "next/link";
import {
  Activity,
  BarChart3,
  Building2,
  Map,
  Radar,
  ShieldHalf,
  Sparkles,
  Zap
} from "lucide-react";
import { cn } from "../../lib/utils";

const items: { key: string; label: string; href: string; icon: React.ElementType }[] = [
  { key: "dashboard", label: "Dashboard", href: "/", icon: Activity },
  { key: "map", label: "Intelligence Map", href: "/map", icon: Map },
  { key: "hiring", label: "Hiring Trends", href: "/hiring", icon: BarChart3 },
  { key: "skills", label: "Skills Gap", href: "/skills", icon: Radar },
  { key: "signals", label: "Economic Signals", href: "/signals", icon: Building2 },
  { key: "training", label: "Training Alignment", href: "/training", icon: ShieldHalf },
  { key: "insights", label: "AI Insights", href: "/insights", icon: Sparkles },
  { key: "scenarios", label: "Scenario Simulator", href: "/scenarios", icon: Zap }
];

interface SidebarNavProps {
  active: string;
}

export function SidebarNav({ active }: SidebarNavProps) {
  return (
    <aside className="print:hidden hidden lg:flex w-[238px] shrink-0 flex-col border-r border-slate-900/80 bg-slate-950/80">
      <div className="flex-1 px-3 py-4 space-y-2">
        <p className="px-2 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
          Navigation
        </p>
        <nav className="space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.key;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  "sidebar-item group flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 transition-colors",
                  "text-slate-400 hover:bg-slate-900/80 hover:text-slate-100",
                  isActive &&
                    "bg-slate-900/90 text-slate-100 shadow-[0_0_0_1px_rgba(56,189,248,0.3)]"
                )}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-900/80 text-slate-400 group-hover:text-sky-300">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="border-t border-slate-900/80 px-3 py-3 text-[10px] text-slate-500">
        Data collection by{" "}
        <span className="font-semibold text-slate-300">Bright Data</span>
      </div>
    </aside>
  );
}
