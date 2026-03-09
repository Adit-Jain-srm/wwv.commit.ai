"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";
import { Star, MapPin, Building2 } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type GlassdoorEntry = {
  company_name?: string;
  overall_rating?: number;
  reviews_count?: number;
  ceo_approval?: number;
  recommend_to_friend?: number;
  url?: string;
};

type GoogleMapsEntry = {
  name?: string;
  category?: string;
  rating?: number;
  reviews_count?: number;
  address?: string;
};

type EmployerQualityData = {
  glassdoor: GlassdoorEntry[];
  google_maps: GoogleMapsEntry[];
  summary: {
    glassdoor_count: number;
    google_maps_count: number;
    avg_employer_rating: number | null;
  };
};

function RatingStars({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`h-3 w-3 ${
            i < full
              ? "fill-amber-400 text-amber-400"
              : i === full && half
                ? "fill-amber-400/50 text-amber-400"
                : "text-slate-600"
          }`}
        />
      ))}
      <span className="ml-1 text-xs text-slate-300">{rating.toFixed(1)}</span>
    </span>
  );
}

export default function EmployerQualityPage() {
  const [data, setData] = useState<EmployerQualityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/employer-quality`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((d) => setData(d))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  const glassdoor = data?.glassdoor ?? [];
  const google_maps = data?.google_maps ?? [];
  const summary = data?.summary ?? { glassdoor_count: 0, google_maps_count: 0, avg_employer_rating: null };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1600px] gap-3 px-3 py-4 laptop:px-4 desktop:px-6">
        <Skeleton className="mb-6 h-8 w-64 rounded-lg bg-slate-900/80" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl bg-slate-900/80" />
          ))}
        </div>
        <Skeleton className="mt-6 h-[320px] w-full rounded-xl bg-slate-900/80" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto w-full max-w-[1600px] gap-3 px-3 py-4 laptop:px-4 desktop:px-6">
        <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-6 text-center">
          <h3 className="text-sm font-medium text-red-400">Failed to load employer quality data</h3>
          <p className="mt-2 text-xs text-slate-400">{error ?? "No data available."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] gap-3 px-3 py-4 laptop:px-4 desktop:px-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-100">Employer Quality</h1>
        <p className="text-sm text-slate-400">
          Glassdoor employer ratings and Google Maps local business signals for Montgomery employers.
        </p>
      </div>

      {/* Summary cards */}
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card className="border-slate-800/80 bg-gradient-to-br from-slate-950 to-amber-950/20 shadow-lg">
          <CardContent className="flex items-center gap-4 py-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-900/40">
              <Star className="h-5 w-5 text-amber-400" />
            </span>
            <div>
              <p className="text-2xl font-bold text-slate-50">
                {summary.avg_employer_rating?.toFixed(1) ?? "N/A"}
              </p>
              <p className="text-xs text-slate-400">Avg employer rating</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800/80 bg-gradient-to-br from-slate-950 to-sky-950/20 shadow-lg">
          <CardContent className="flex items-center gap-4 py-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-900/40">
              <Building2 className="h-5 w-5 text-sky-400" />
            </span>
            <div>
              <p className="text-2xl font-bold text-slate-50">{summary.glassdoor_count}</p>
              <p className="text-xs text-slate-400">Employers tracked</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800/80 bg-gradient-to-br from-slate-950 to-emerald-950/20 shadow-lg">
          <CardContent className="flex items-center gap-4 py-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-900/40">
              <MapPin className="h-5 w-5 text-emerald-400" />
            </span>
            <div>
              <p className="text-2xl font-bold text-slate-50">{summary.google_maps_count}</p>
              <p className="text-xs text-slate-400">Local businesses discovered</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Glassdoor employer ratings */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-slate-800/80 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <Star className="h-4 w-4 text-amber-400" />
              Employer Ratings
            </CardTitle>
          </CardHeader>
          <CardContent>
            {glassdoor.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">
                No Glassdoor data. Run the pipeline with --glassdoor to collect.
              </p>
            ) : (
              <div className="max-h-[380px] space-y-2 overflow-y-auto pr-1">
                {glassdoor
                  .sort((a, b) => (b.overall_rating ?? 0) - (a.overall_rating ?? 0))
                  .map((emp, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-950/50 px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-200">
                          {emp.company_name ?? "Unknown employer"}
                        </p>
                        <div className="mt-0.5 flex items-center gap-3 text-[11px] text-slate-400">
                          {emp.reviews_count != null && (
                            <span>{emp.reviews_count.toLocaleString()} reviews</span>
                          )}
                          {emp.recommend_to_friend != null && (
                            <span>{emp.recommend_to_friend}% recommend</span>
                          )}
                        </div>
                      </div>
                      {emp.overall_rating != null && (
                        <RatingStars rating={emp.overall_rating} />
                      )}
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Google Maps local businesses */}
        <Card className="border-slate-800/80 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <MapPin className="h-4 w-4 text-emerald-400" />
              Local Business Discovery
            </CardTitle>
          </CardHeader>
          <CardContent>
            {google_maps.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">
                No Google Maps data. Run the pipeline with --google-maps to collect.
              </p>
            ) : (
              <div className="max-h-[380px] space-y-2 overflow-y-auto pr-1">
                {google_maps.map((biz, i) => (
                  <div
                    key={i}
                    className="flex items-start justify-between rounded-lg border border-slate-800/60 bg-slate-950/50 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-200">
                        {biz.name ?? "Unknown business"}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">
                        {biz.category && (
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase">
                            {biz.category}
                          </span>
                        )}
                        {biz.address && (
                          <span className="truncate max-w-[180px]">{biz.address}</span>
                        )}
                      </div>
                    </div>
                    {biz.rating != null && (
                      <div className="ml-2 shrink-0 text-right">
                        <RatingStars rating={biz.rating} />
                        {biz.reviews_count != null && (
                          <p className="mt-0.5 text-[10px] text-slate-500">
                            {biz.reviews_count.toLocaleString()} reviews
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
