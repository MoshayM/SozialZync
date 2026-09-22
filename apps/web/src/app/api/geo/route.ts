import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

// Countries where TikTok is government-banned
const TIKTOK_BANNED = new Set(['IN']); // India (June 2020 ban, still active)

export async function GET() {
  const h = await headers();
  // Vercel injects x-vercel-ip-country on all edge requests
  const country = h.get('x-vercel-ip-country') ?? 'IN'; // default conservative
  return NextResponse.json({
    country,
    tiktokAvailable: !TIKTOK_BANNED.has(country),
  });
}
