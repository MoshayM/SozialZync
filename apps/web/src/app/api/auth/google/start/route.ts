import { NextResponse } from 'next/server';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'https://sozialzync-api-production.up.railway.app/api/v1';

export async function POST(req: Request) {
  const body = await req.json() as { redirectUri?: string; mode?: string };

  if (!body.redirectUri) {
    return NextResponse.json({ error: 'redirectUri required' }, { status: 400 });
  }

  try {
    const res = await fetch(`${API_BASE}/auth/google/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Failed to reach auth server' }, { status: 502 });
  }
}
