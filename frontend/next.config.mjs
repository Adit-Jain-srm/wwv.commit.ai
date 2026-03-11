import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Only apply basePath for GitHub Pages; Vercel/local serve from root.
const basePath =
  "NEXT_PUBLIC_BASE_PATH" in process.env
    ? process.env.NEXT_PUBLIC_BASE_PATH
    : process.env.GITHUB_ACTIONS
      ? "/wwv.commit.ai"
      : "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  basePath: basePath,
  assetPrefix: basePath ? `${basePath}/` : "",
  images: {
    unoptimized: true,
  },
  reactStrictMode: false,
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
