import { NextResponse } from 'next/server';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'https://sozialzync-api-production.up.railway.app/api/v1';

export async function POST(req: Request) {
  const body = await req.json() as { code?: string; state?: string; redirectUri?: string };

  if (!body.code || !body.state) {
    return NextResponse.json({ error: 'code and state required' }, { status: 400 });
  }

  try {
    const res = await fetch(`${API_BASE}/auth/google/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': req.headers.get('x-forwarded-for') ?? '',
        'user-agent':      req.headers.get('user-agent') ?? '',
      },
      // Railway DTO only accepts code + state — strip redirectUri
      body: JSON.stringify({ code: body.code, state: body.state }),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Failed to reach auth server' }, { status: 502 });
  }
}
