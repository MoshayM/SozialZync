import { NextResponse } from 'next/server';

interface GoogleTokenResponse {
  access_token?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleUserInfo {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  email_verified?: boolean;
}

export async function POST(req: Request) {
  const body = await req.json() as { code?: string; state?: string; redirectUri?: string };
  const { code, redirectUri } = body;

  if (!code || !redirectUri) {
    return NextResponse.json({ error: 'code and redirectUri required' }, { status: 400 });
  }

  const clientId     = process.env['GOOGLE_CLIENT_ID'];
  const clientSecret = process.env['GOOGLE_CLIENT_SECRET'];

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'Google OAuth not configured' }, { status: 503 });
  }

  // Exchange authorization code for access token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     clientId,
      client_secret: clientSecret,
      redirect_uri:  redirectUri,
      grant_type:    'authorization_code',
    }),
  });

  const tokens = await tokenRes.json() as GoogleTokenResponse;
  if (!tokenRes.ok || !tokens.access_token) {
    return NextResponse.json(
      { error: 'token_exchange_failed', message: tokens.error_description ?? 'Google token exchange failed' },
      { status: 401 },
    );
  }

  // Fetch user profile from Google
  const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!userRes.ok) {
    return NextResponse.json({ error: 'Failed to fetch user info from Google' }, { status: 502 });
  }

  const user = await userRes.json() as GoogleUserInfo;

  // Mint a lightweight access token (no Railway needed)
  // Format: google|<sub>|<iat> — non-JWT, verified only by presence in localStorage
  const accessToken  = `google|${user.sub}|${Date.now()}`;
  const refreshToken = `google-refresh|${user.sub}`;

  return NextResponse.json({
    accessToken,
    refreshToken,
    user: {
      id:        user.sub,
      email:     user.email,
      name:      user.name,
      avatarUrl: user.picture ?? null,
      role:      'USER',
    },
  });
}
