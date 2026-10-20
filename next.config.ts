import type { NextConfig } from "next";

// No basePath: the app lives at the root of its *.vercel.app URL.
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // The service worker file must never be served from a stale cache,
        // otherwise a fixed version would not reach the phone.
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
    ];
  },
};

export default nextConfig;
