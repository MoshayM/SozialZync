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

  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    // Next.js 15 generates inline RSC streaming scripts (self.__next_f.push)
    // that are not nonce-annotated by the framework. CSP L2+ browsers silently
    // ignore 'unsafe-inline' whenever a nonce is also present in the directive,
    // so mixing nonce + unsafe-inline still blocks those scripts. Until Next.js
    // natively annotates its streaming scripts, 'unsafe-inline' without a nonce
    // is the only working option. The nonce is still generated and forwarded via
    // x-nonce so explicit <Script nonce={nonce}> components can use it.
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
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
