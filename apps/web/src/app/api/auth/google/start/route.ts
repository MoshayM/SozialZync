import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const body = await req.json() as { redirectUri?: string; mode?: string };
  const { redirectUri, mode = 'login' } = body;

  if (!redirectUri) {
    return NextResponse.json({ error: 'redirectUri required' }, { status: 400 });
  }

  const clientId = process.env['GOOGLE_CLIENT_ID'];
  if (!clientId) {
    return NextResponse.json({ error: 'Google OAuth not configured' }, { status: 503 });
  }

  const state = `${mode}:${crypto.randomUUID()}`;

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         'openid email profile',
    state,
    access_type:   'offline',
    prompt:        'select_account',
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  return NextResponse.json({ authUrl, state });
}
