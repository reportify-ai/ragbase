import type { NextConfig } from "next";

// Disable Rust logging for LanceDB
process.env.RUST_LOG = 'off';

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  /* config options here */
  serverExternalPackages: ["@lancedb/lancedb"],
  
  // Disable React strict mode to avoid component double mounting
  reactStrictMode: false
};

export default nextConfig;
