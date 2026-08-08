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

  const adminEmail = process.env['ADMIN_EMAIL'] ?? process.env['SMTP_USER'];
  const secret = process.env['INTERNAL_API_SECRET'];
  const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? '';

  if (adminEmail && secret && appUrl) {
    try {
      await fetch(`${appUrl}/api/internal/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': secret,
        },
        body: JSON.stringify({
          to: adminEmail,
          subject: `[Sozialzync] App launch notification signup — ${label}`,
          text: `New user signed up to be notified when the Sozialzync ${label} app launches.\n\nEmail: ${email}\nPlatform: ${platform}\nTimestamp: ${new Date().toISOString()}`,
          html: `<p>New signup for <strong>${label}</strong> launch notification.</p><p>Email: <strong>${email}</strong></p><p>Platform: ${platform}</p>`,
        }),
      });
    } catch (err) {
      console.error('[app-notify] email relay error:', err);
    }
  }

  return NextResponse.json({ ok: true });
}
