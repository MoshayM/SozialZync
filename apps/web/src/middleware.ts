import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/login(.*)',
  '/register(.*)',
  '/forgot-password(.*)',
  '/reset-password(.*)',
  '/set-password(.*)',
  '/oauth(.*)',
  '/api/proxy/(.*)',
  '/api/(.*)',
  '/_next/(.*)',
  '/icon.svg',
  '/manifest.json',
  '/sw.js',
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    const { userId } = await auth();
    if (!userId) {
      // Fall back to localStorage-based auth (legacy JWT path)
      // The DashLayout already handles redirect to /login for missing cf_token
      return NextResponse.next();
    }
  }
  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.json|sw.js).*)',
  ],
};
