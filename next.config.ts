import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

// Baseline security headers. Kept out of the app code so they also cover
// errors, redirects, and any route that forgets to set its own.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  // frame-ancestors is the modern equivalent of X-Frame-Options; declaring
  // both keeps older browsers protected without restricting script sources
  // (which would break wagmi/RainbowKit's wallet iframes).
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    // Camera is intentionally left enabled: some wallet connectors use it for
    // QR scanning. Nothing in the app needs microphone or geolocation.
    value: "microphone=(), geolocation=(), payment=()",
  },
  ...(isProduction
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  // Do not advertise the framework version to scanners.
  poweredByHeader: false,
  reactStrictMode: true,
  turbopack: {
    // Pin the workspace root to this project; otherwise a lockfile in a parent
    // directory makes Next infer that parent as root and module resolution fails.
    root: process.cwd(),
  },
  webpack: (config) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
  images: {
    // Only HTTPS upstreams are accepted. The previous `http: **` rule let the
    // image optimizer fetch plaintext hosts (including internal ones on some
    // runtimes), turning /_next/image into an SSRF/bandwidth proxy.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
    // Cap optimizer side effects and avoid serving user SVGs through it.
    dangerouslyAllowSVG: false,
    minimumCacheTTL: 60,
    contentDispositionType: "attachment",
  },
  // The marketing landing page lives at "/". The old /dashboard route was
  // removed, so keep any inbound links from 404ing.
  async redirects() {
    return [
      {
        source: "/dashboard",
        destination: "/",
        permanent: true,
      },
      // Raffles are hidden for now. Redirect the public page and any old
      // detail links before they can render.
      {
        source: "/raffles",
        destination: "/home",
        permanent: false,
      },
      {
        source: "/raffles/:path*",
        destination: "/home",
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;

// Lets `next dev` use the Cloudflare bindings defined in wrangler.jsonc.
// No-op in production builds.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();
