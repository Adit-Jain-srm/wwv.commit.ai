import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Leaflet + React-Leaflet do not play nicely with
  // React 18's double-mount behavior in StrictMode,
  // which causes "Map container is already initialized".
  // Disable StrictMode for this hackathon dashboard
  // so the map only initializes once in dev.
  reactStrictMode: false,
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;

