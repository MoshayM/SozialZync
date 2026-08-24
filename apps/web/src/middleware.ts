import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Edge-runtime safe nonce: 16 random bytes → base64
function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export function middleware(req: NextRequest) {
  const nonce = generateNonce();
  const isDev = process.env.NODE_ENV !== 'production';

  const apiOrigin = (() => {
    try {
      return new URL(process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4007/api/v1').origin;
    } catch {
      return 'http://localhost:4007';
    }
  })();
  const wsOrigin = apiOrigin.replace(/^http/, 'ws');
  const sentryHosts = process.env['SENTRY_DSN'] ? ' https://*.sentry.io' : '';

  // script-src uses a per-request nonce instead of 'unsafe-inline'.
  // Next.js 14 App Router reads the x-nonce request header and automatically
  // applies it to its generated inline scripts (__NEXT_DATA__, etc.).
  // style-src keeps 'unsafe-inline' — inline style="" attributes are needed by
  // Radix/Framer and Next.js font injection; CSS can't execute JS so the risk
  // profile is fundamentally different from script-src.
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    // 'unsafe-inline' is listed for legacy browsers only.
    // Any browser that supports nonces (Chrome, Firefox, Edge, Safari) will
    // IGNORE 'unsafe-inline' when a valid nonce is also present (CSP level 2+
    // spec §8.2). This is belt-and-suspenders: modern browsers get nonce
    // enforcement; older ones fall back to unsafe-inline as before.
    `script-src 'self' 'nonce-${nonce}' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://i.ytimg.com https://yt3.googleusercontent.com",
    "font-src 'self' data:",
    "worker-src 'self' blob:",
    `media-src 'self' blob: ${apiOrigin}`,
    `connect-src 'self' ${apiOrigin} ${wsOrigin}${sentryHosts}`,
  ].join('; ');

  // Forward nonce to RSC / root layout via request header
  const reqHeaders = new Headers(req.headers);
  reqHeaders.set('x-nonce', nonce);

  const res = NextResponse.next({ request: { headers: reqHeaders } });
  res.headers.set('Content-Security-Policy', csp);
  return res;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.json|sw.js).*)',
  ],
};
