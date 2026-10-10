import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Do not set turbopack.root / outputFileTracingRoot to path.resolve(".").
  // That bakes an absolute machine path into the build (e.g. /workspace or
  // /vercel/path0) and can confuse Vercel routing / file tracing for App Router.
  async headers() {
    const manageHeaders = [
      { key: "Cache-Control", value: "no-store, max-age=0, must-revalidate" },
      { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
      { key: "Referrer-Policy", value: "no-referrer" },
    ];
    return [
      { source: "/appointments/manage", headers: manageHeaders },
      { source: "/appointments/manage/:path*", headers: manageHeaders },
      { source: "/booking/manage", headers: manageHeaders },
      { source: "/booking/manage/:path*", headers: manageHeaders },
      { source: "/api/booking/manage", headers: manageHeaders },
    ];
  },
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [64, 96, 128, 256, 384],
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
