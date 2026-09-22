import { NextResponse } from 'next/server';

export function GET() {
  return new NextResponse('google-site-verification: googleb51a815cd9abb4eb.html', {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
