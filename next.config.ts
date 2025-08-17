import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  /* config options here */
  serverExternalPackages: ["@lancedb/lancedb"],
  
  // Disable React strict mode to avoid component double mounting
  reactStrictMode: false,
  
  // For Tauri, we need to support API routes, so we don't use static export
  // The app will be served by the embedded Next.js server
  images: {
    unoptimized: true
  }
};

export default nextConfig;
