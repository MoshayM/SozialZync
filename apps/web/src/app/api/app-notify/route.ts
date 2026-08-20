import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';

const BodySchema = z.object({
  email: z.string().email(),
  platform: z.enum(['android', 'ios']),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 422 });
  }

  const { email, platform } = parsed.data;
  const label = platform === 'android' ? 'Google Play (Android)' : 'App Store (iOS)';

  console.log(`[app-notify] ${platform} launch signup: ${email}`);

  return NextResponse.json({ ok: true });
}
