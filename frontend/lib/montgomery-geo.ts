/**
 * Centralized Montgomery, AL geographic constants.
 * Used by DashboardShell, map pages, and map components.
 */

export const MONTGOMERY_CENTER = { lat: 32.3668, lng: -86.3006 } as const;
export const DEFAULT_ZOOM = 11;

export const NEIGHBORHOOD_COORDS: Record<string, { lat: number; lng: number }> = {
  "Downtown Montgomery": { lat: 32.3775, lng: -86.3077 },
  "Maxwell / Gunter Area": { lat: 32.3827, lng: -86.3652 },
  "East Montgomery": { lat: 32.366, lng: -86.154 },
  "West Montgomery": { lat: 32.373, lng: -86.345 },
  "Midtown": { lat: 32.381, lng: -86.303 },
  "Capitol Heights": { lat: 32.370, lng: -86.290 },
  "Cloverdale": { lat: 32.358, lng: -86.315 },
  "Dalraida": { lat: 32.404, lng: -86.267 },
  "Pike Road": { lat: 32.312, lng: -86.098 },
  "Prattville": { lat: 32.464, lng: -86.457 },
  "Old Cloverdale": { lat: 32.356, lng: -86.313 },
  "Normandale": { lat: 32.395, lng: -86.248 },
};
