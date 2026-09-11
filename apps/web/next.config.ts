import type { NextConfig } from 'next';

// Non-CSP security headers. CSP is set per-request in middleware.ts so it can
// carry a unique nonce — static headers() here can't generate per-request values.
//
// OWASP A05 — Security misconfiguration: headers hardened beyond Next.js defaults.
const securityHeaders = [
  // A05 — Prevent MIME-type sniffing (e.g. serving a script as text/plain)
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // A05 — Deny all framing (clickjacking). middleware.ts also sets frame-ancestors in CSP.
  { key: 'X-Frame-Options', value: 'DENY' },
  // A02 — Don't leak the full URL when navigating to external sites
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // A05 — Restrict browser feature access; microphone=(self) for voice recording feature
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=(), payment=(), usb=(), serial=(), bluetooth=()' },
  // A02 — HSTS: 2 years + subdomains + preload (browsers cache this and force HTTPS)
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // A05 — Prevent this page from being opened by cross-origin windows (tabnapping)
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  // A05 — Resources (fonts, images) served from this origin require explicit cross-origin allow
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  // A05 — Prevent DNS prefetching (minor info leak for internal routes)
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // Run in demo/mock mode — no Railway backend required
  env: {
    NEXT_PUBLIC_USE_MOCK: 'true',
  },
  // ZAP baseline rule 10037: don't advertise the framework.
  poweredByHeader: false,
  devIndicators: false,
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3007', 'sozialzync.vercel.app'] },
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'yt3.googleusercontent.com' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
    ],
  },
  async redirects() {
    return [
      // Old individual Publish routes → combined /publish page
      { source: '/publishing',    destination: '/publish?tab=publishing',    permanent: false },
      { source: '/approvals',     destination: '/publish?tab=approvals',     permanent: false },
      { source: '/scheduler',     destination: '/publish?tab=scheduler',     permanent: false },
      // /autonomy is now a live page (Autopilot) — keep the publish tab reachable via query param
      { source: '/automation',    destination: '/autonomy',                  permanent: false },
      { source: '/ab-testing',    destination: '/publish?tab=ab-testing',    permanent: false },
      // Old individual Content routes → combined /content page
      { source: '/research',      destination: '/content?tab=research',      permanent: false },
      { source: '/discover',      destination: '/content?tab=discover',      permanent: false },
      { source: '/repurpose',     destination: '/content?tab=repurpose',     permanent: false },
      { source: '/series-planner',destination: '/content?tab=series-planner',permanent: false },
      { source: '/score-script',  destination: '/content?tab=score-script',  permanent: false },
      // Old individual Insights routes → combined /insights page
      { source: '/analytics',     destination: '/insights?tab=analytics',    permanent: false },
      { source: '/strategy',      destination: '/studio',                    permanent: false },
      { source: '/growth',        destination: '/insights?tab=growth',       permanent: false },
      { source: '/monitor',       destination: '/insights?tab=monitor',      permanent: false },
    ];
  },
};

// Wrap with Sentry only when DSN is configured (skip entirely in local dev without DSN)
let exportedConfig: NextConfig = nextConfig;
if (process.env['SENTRY_DSN']) {
  try {
    const { withSentryConfig } = require('@sentry/nextjs') as { withSentryConfig: (c: NextConfig, o: object) => NextConfig };
    exportedConfig = withSentryConfig(nextConfig, {
      silent: true,
      widenClientFileUpload: true,
      hideSourceMaps: true,
      disableLogger: true,
      automaticVercelMonitors: false,
    });
  } catch {
    // @sentry/nextjs not installed — fine
  }
}

export default exportedConfig;
