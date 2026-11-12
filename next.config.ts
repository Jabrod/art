import type { NextConfig } from "next"

/**
 * The studio is one zone of art.jabrod.com (Next.js multi-zones): jabrod.com's app rewrites
 * /studio/** on the art host to this app, so every page and asset lives under /studio.
 * In development that is art.localhost:3000/studio → localhost:3100/studio.
 */
const nextConfig: NextConfig = {
  basePath: "/studio",
  allowedDevOrigins: ["art.localhost", "localhost", "127.0.0.1"],
  images: { unoptimized: true },
}

export default nextConfig
