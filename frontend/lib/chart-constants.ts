import type { CSSProperties } from "react";

/** Shared 6-month projection multiplier (14% growth). */
export const PROJECTION_FACTOR = 1.14;

/** Dark-theme tooltip style reused across all Recharts charts. */
export const CHART_TOOLTIP_STYLE: CSSProperties = {
  backgroundColor: "#020617",
  border: "1px solid #1f2937",
  borderRadius: 8,
  fontSize: 11,
};

/** Industry color palette for timeseries and breakdown charts. */
export const INDUSTRY_COLORS: Record<string, string> = {
  government: "#38bdf8",
  defense: "#e5e7eb",
  healthcare: "#22c55e",
  manufacturing: "#f97316",
  technology: "#a855f7",
  education: "#facc15",
  public_safety: "#f97373",
};

/** Human-readable labels for industry keys. */
export const INDUSTRY_LABELS: Record<string, string> = {
  government: "Government",
  defense: "Defense",
  healthcare: "Healthcare",
  manufacturing: "Manufacturing",
  technology: "Technology",
  education: "Education",
  public_safety: "Public Safety",
};

/**
 * Compute workforce gap score as a percentage (0-100).
 * Unified formula used by both dashboard and PDF export.
 */
export function computeGapScore(
  skillsGapList: { skill: string; gap: boolean; local_training_available: boolean }[]
): number {
  if (!skillsGapList.length) return 0;
  const gapCount = skillsGapList.filter((g) => g.gap).length;
  return Math.round((gapCount / skillsGapList.length) * 100);
}

/** Ordered list of industry keys for chart series. */
export const INDUSTRY_KEYS = [
  "government", "defense", "healthcare", "manufacturing",
  "technology", "education", "public_safety",
] as const;

export type IndustryKey = (typeof INDUSTRY_KEYS)[number];

/** Decision-support chart title mappings. */
export const CHART_TITLES = {
  hiringTrends: "Sector Hiring Velocity \u2014 Decision Intelligence",
  industryBreakdown: "Sector Employment Share \u2014 Resource Allocation Guide",
  skillsDemand: "Critical Skills Demand \u2014 Training Investment Priorities",
  trainingAlignment: "Training Pipeline Alignment \u2014 Capacity vs. Demand",
  dataCenterImpact: "Data Center Impact Assessment",
} as const;

/** Threshold values for "action needed" indicators. */
export const THRESHOLDS = {
  gapScoreWarning: 60,
  gapScoreCritical: 80,
  jobGrowthStagnant: 2,
  trainingGapCritical: 2.0,
} as const;

/** Gradient ID for industry area chart fills. */
export function industryGradientId(key: string): string {
  return `grad-${key}`;
}
