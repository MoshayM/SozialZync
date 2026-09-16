import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

const RAILWAY_URL = (
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'https://sozialzync-api-production.up.railway.app/api/v1'
).replace(/\/api\/v1\/?$/, '');

export async function GET(req: Request) {
  // Vercel Cron injects Authorization: Bearer <CRON_SECRET> on scheduled calls.
  // Block unauthenticated external hits when CRON_SECRET is set.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization') ?? '';
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 8_000);
    let status: number;
    let body: unknown;
    try {
      const res = await fetch(`${RAILWAY_URL}/health`, {
        signal: ac.signal,
        headers: { 'User-Agent': 'vercel-keep-warm/1.0' },
      });
      status = res.status;
      body = await res.json().catch(() => null);
    } finally {
      clearTimeout(timer);
    }
    return NextResponse.json({ ok: status === 200, status, body });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
