import path from "node:path";
import type { NextConfig } from "next";

// The chain indexer + build API (services/api.ts) runs as its own process so
// relayer keys never live in the web server. The browser only ever talks to
// this origin; /svc is proxied through.
const API = process.env.UP_API_URL ?? "http://127.0.0.1:8790";

const nextConfig: NextConfig = {
  turbopack: { root: path.resolve(".") },
  // Lets phones on the same network open the stage form during the demo.
  allowedDevOrigins: ["192.168.*.*"],
  async rewrites() {
    return [{ source: "/svc/:path*", destination: `${API}/:path*` }];
  },
};

export default nextConfig;
