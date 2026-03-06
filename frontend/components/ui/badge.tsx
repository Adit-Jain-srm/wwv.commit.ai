import * as React from "react";
import { cn } from "../../lib/utils";

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "outline" | "success" | "warning" | "danger";
}

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  const base =
    "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em]";
  const variants: Record<NonNullable<BadgeProps["variant"]>, string> = {
    default:
      "border-slate-700/80 bg-slate-900/80 text-slate-200",
    outline: "border-slate-600/80 text-slate-300",
    success:
      "border-emerald-500/60 bg-emerald-500/10 text-emerald-300",
    warning:
      "border-amber-500/60 bg-amber-500/10 text-amber-300",
    danger:
      "border-red-500/60 bg-red-500/10 text-red-300"
  };

  return (
    <span className={cn(base, variants[variant], className)} {...props} />
  );
}

