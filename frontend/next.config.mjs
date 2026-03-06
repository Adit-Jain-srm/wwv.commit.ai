/** @type {import('next').NextConfig} */
const nextConfig = {
  // Leaflet + React-Leaflet do not play nicely with
  // React 18's double-mount behavior in StrictMode,
  // which causes "Map container is already initialized".
  // Disable StrictMode for this hackathon dashboard
  // so the map only initializes once in dev.
  reactStrictMode: false,
};

export default nextConfig;

