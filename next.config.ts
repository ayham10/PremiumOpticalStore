import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Do not set turbopack.root / outputFileTracingRoot to path.resolve(".").
  // That bakes an absolute machine path into the build (e.g. /workspace or
  // /vercel/path0) and can confuse Vercel routing / file tracing for App Router.
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
