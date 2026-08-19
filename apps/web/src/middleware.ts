import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Auth is handled client-side via DashLayout checking cf_token in localStorage.
// This middleware is a passthrough — add route-level guards here if needed.
export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.json|sw.js).*)',
  ],
};
