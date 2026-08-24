import type { NextConfig } from 'next';

// Non-CSP security headers. CSP is set per-request in middleware.ts so it can
// carry a unique nonce — static headers() here can't generate per-request values.
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
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
