import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { Resend } from 'resend';

// Internal email relay — called by the Railway NestJS backend so that
// email is sent from Vercel (AWS infra) which allows outbound SMTP port 587,
// unlike Railway whose network blocks all outbound SMTP.

export const runtime = 'nodejs';

interface SendEmailBody {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Shared secret guards this endpoint from public access.
  const secret = process.env['INTERNAL_API_SECRET'];
  if (!secret) {
    return NextResponse.json({ error: 'Relay not configured' }, { status: 503 });
  }
  const provided = req.headers.get('x-internal-secret');
  if (!provided || provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: SendEmailBody;
  try {
    body = (await req.json()) as SendEmailBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const { to, subject, html, text } = body;
  if (!to || !subject) {
    return NextResponse.json({ error: 'Missing to or subject' }, { status: 400 });
  }

  // 1. Resend SDK (if RESEND_API_KEY + verified domain configured in Vercel).
  const resendKey = process.env['RESEND_API_KEY'];
  if (resendKey) {
    const from = process.env['RESEND_FROM'] ?? 'onboarding@resend.dev';
    const resend = new Resend(resendKey);
    const { error } = await resend.emails.send({ from, to, subject, html, text });
    if (!error) return NextResponse.json({ ok: true });
    const code = (error as unknown as { statusCode?: number }).statusCode;
    if (code !== 403) {
      return NextResponse.json({ error: `Resend: ${error.message}` }, { status: 502 });
    }
    // 403 = domain restriction — fall through to SMTP.
    console.warn(`[relay] Resend domain restriction for ${to} — falling back to SMTP`);
  }

  // 2. Gmail SMTP via App Password — works from Vercel (AWS), not blocked unlike Railway.
  const smtpHost = process.env['SMTP_HOST'];
  if (smtpHost) {
    const smtpUser = process.env['SMTP_USER'];
    const smtpFrom = process.env['SMTP_FROM'] ?? smtpUser ?? 'noreply@sozialzync.com';
    // Google App Passwords are displayed with spaces but auth requires them stripped.
    const rawPass = process.env['SMTP_PASS'] ?? '';
    const smtpPass = rawPass.replace(/\s/g, '');
    console.log(`[relay] SMTP config: host=${smtpHost} user=${smtpUser} passLen=${smtpPass.length}`);
    const transport = nodemailer.createTransport({
      host: smtpHost,
      port: Number(process.env['SMTP_PORT'] ?? 587),
      secure: process.env['SMTP_SECURE'] === 'true',
      auth: { user: smtpUser, pass: smtpPass },
    });
    try {
      await transport.sendMail({ from: smtpFrom, to, subject, text, html });
      return NextResponse.json({ ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[relay] SMTP failed: user=${smtpUser} passLen=${smtpPass.length} err=${msg}`);
      return NextResponse.json({ error: `SMTP: ${msg}` }, { status: 502 });
    }
  }

  return NextResponse.json({ error: 'No email provider configured on Vercel relay' }, { status: 503 });
}
