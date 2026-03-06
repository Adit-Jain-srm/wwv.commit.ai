"use client";

import { useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

export type MapNeighborhoodDatum = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  job_density_score: number;
  workforce_desert: boolean;
  top_sector: string;
  cluster_type?: "jobs" | "new_business" | "mixed";
};

interface WorkforceIntelligenceMapProps {
  data: MapNeighborhoodDatum[];
}

const MONTGOMERY_CENTER: LatLngExpression = [32.3668, -86.3006];

const DARK_TILE =
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

export function WorkforceIntelligenceMap({ data }: WorkforceIntelligenceMapProps) {
  const [layers, setLayers] = useState({
    jobs: true,
    businesses: true,
    skills: true,
    education: true,
  });

  const toggle = (key: keyof typeof layers) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <Card className="min-h-[550px] overflow-hidden border-slate-800/80 shadow-xl shadow-slate-900/30 transition-all duration-300 hover:shadow-2xl">
      <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <CardTitle className="text-lg font-semibold text-slate-100">
          Workforce Intelligence Map — Montgomery Command Center
        </CardTitle>
        <div className="flex flex-wrap gap-2">
          {(["jobs", "businesses", "skills", "education"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              className={`rounded-md px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider transition-colors ${
                layers[key]
                  ? "bg-sky-600/90 text-slate-50"
                  : "bg-slate-800/80 text-slate-500 hover:text-slate-300"
              }`}
            >
              {key}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="h-[520px] p-0">
        <MapContainer
          center={MONTGOMERY_CENTER}
          zoom={11}
          scrollWheelZoom
          className="h-full w-full rounded-b-xl"
        >
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url={DARK_TILE}
          />
          {layers.jobs &&
            data.map((n) => {
              const intensity = Math.min(Math.max(n.job_density_score / 100, 0.2), 1);
              const radius = 10 + (n.job_density_score / 100) * 20;
              const baseColor =
                n.cluster_type === "jobs"
                  ? "#2563eb"
                  : n.cluster_type === "new_business"
                    ? "#22c55e"
                    : "#a855f7";
              const fillOpacity = n.workforce_desert ? 0.25 : 0.7;

              return (
                <CircleMarker
                  key={n.id}
                  center={[n.lat, n.lng]}
                  radius={radius}
                  color={baseColor}
                  weight={n.workforce_desert ? 2 : 1}
                  fillColor={baseColor}
                  fillOpacity={fillOpacity * intensity}
                >
                  <Tooltip
                    direction="top"
                    offset={[0, -8]}
                    opacity={1}
                    className="!bg-slate-900 !border-slate-600 !text-slate-100 !rounded-lg !px-3 !py-2"
                  >
                    <div className="space-y-2 min-w-[180px]">
                      <div className="text-sm font-semibold text-slate-50">
                        {n.name}
                      </div>
                      <div className="grid grid-cols-1 gap-1 text-[11px]">
                        <div className="flex justify-between">
                          <span className="text-slate-400">{n.top_sector} share</span>
                          <span className="font-mono text-slate-200">{n.job_density_score}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Top sector</span>
                          <span className="font-semibold text-sky-300 capitalize">{n.top_sector}</span>
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-700">
                        {n.workforce_desert
                          ? "⚠ Workforce desert — training focus recommended"
                          : "Healthy labor market"}
                      </div>
                    </div>
                  </Tooltip>
                </CircleMarker>
              );
            })}
        </MapContainer>
      </CardContent>
    </Card>
  );
}
