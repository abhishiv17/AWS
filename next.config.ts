import type { NextConfig } from "next";

const origin = (url: string | undefined) => {
  try {
    return url ? new URL(url.trim()).origin : "";
  } catch {
    return "";
  }
};

const realtimeOrigin = origin(process.env.NEXT_PUBLIC_EVENTS_REALTIME_URL);
const httpHost = process.env.NEXT_PUBLIC_EVENTS_HTTP_HOST?.trim();
const httpOrigin = httpHost ? `https://${httpHost}` : "";

/**
 * Production only: `next dev` needs eval and its own HMR socket.
 * Inline scripts are required by the App Router without per-request nonces;
 * `wasm-unsafe-eval` is required by the Rapier physics engine.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self' ${realtimeOrigin} ${httpOrigin}`.replace(/\s+/g, " ").trim(),
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ...(process.env.NODE_ENV === "production"
    ? [
        { key: "Content-Security-Policy", value: contentSecurityPolicy },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
      ]
    : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
