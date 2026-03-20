import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "2gb",
    },
  },
  // Allow large file uploads via route handlers
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
