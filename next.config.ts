import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable static export for Electron builds
  output: process.env.ELECTRON_BUILD ? 'export' : undefined,

  // For static export, we need to disable image optimization
  images: {
    unoptimized: true,
  },

  // Ensure trailing slashes for file:// protocol compatibility
  trailingSlash: true,
};

export default nextConfig;
