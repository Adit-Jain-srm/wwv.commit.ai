"use client";

import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

export type NeighborhoodDatum = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  job_density_score: number;
  workforce_desert: boolean;
  top_sector: string;
  cluster_type: "jobs" | "new_business" | "mixed";
};

interface WorkforceMapProps {
  data: NeighborhoodDatum[];
}

const MONTGOMERY_CENTER: LatLngExpression = [32.3668, -86.3006];

export function WorkforceMap({ data }: WorkforceMapProps) {
  return (
    <Card className="h-[400px] overflow-hidden shadow-lg shadow-slate-900/20 transition-shadow">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-slate-100">
          Geographic workforce map — Montgomery neighborhoods
        </CardTitle>
      </CardHeader>
      <CardContent className="h-[340px] p-0">
        <MapContainer
          center={MONTGOMERY_CENTER}
          zoom={11}
          scrollWheelZoom={false}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {data.map((n) => {
            const intensity = Math.min(Math.max(n.job_density_score / 100, 0.2), 1);
            const radius = 8 + (n.job_density_score / 100) * 16;
            const baseColor =
              n.cluster_type === "jobs"
                ? "#2563eb"
                : n.cluster_type === "new_business"
                  ? "#22c55e"
                  : "#a855f7";
            const fillOpacity = n.workforce_desert ? 0.25 : 0.6;

            return (
              <CircleMarker
                key={n.id}
                center={[n.lat, n.lng]}
                radius={radius}
                color={baseColor}
                weight={n.workforce_desert ? 1 : 0}
                fillColor={baseColor}
                fillOpacity={fillOpacity * intensity}
              >
                <Tooltip
                direction="top"
                offset={[0, -4]}
                opacity={1}
                className="!bg-slate-900 !border-slate-600 !text-slate-100"
              >
                  <div className="space-y-1 px-0.5">
                    <div className="text-xs font-semibold text-slate-100">
                      {n.name}
                    </div>
                    <div className="text-[11px] text-slate-200">
                      Job density score:{" "}
                      <span className="font-mono">{n.job_density_score}</span>
                    </div>
                    <div className="text-[11px] text-slate-200">
                      Top sector:{" "}
                      <span className="font-semibold">{n.top_sector}</span>
                    </div>
                    <div className="text-[11px] text-slate-300">
                      {n.workforce_desert
                        ? "Flagged workforce desert"
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

