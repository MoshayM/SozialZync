import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthService } from './auth.service';
import { TrialService } from '../trial/trial.service';
import type { SessionMeta } from './sessions.service';

const OTP_EXPIRY_MS = 10 * 60 * 1000;
const OTP_MAX_PER_WINDOW = 5;

/** Dev-only in-memory store so /auth/otp/dev-peek can surface codes without email. */
const DEV_OTP_STORE = new Map<string, { code: string; expiresAt: number }>();

/**
 * Temporary phone→email links collected during first-time phone OTP sign-in.
 * Consumed in verify(). Expires with the OTP window.
 */
const PENDING_PHONE_EMAIL = new Map<string, { email: string; expiresAt: number }>();

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const m =
    local.length <= 2
      ? local[0] + '***'
      : local[0] + '***' + local[local.length - 1];
  return `${m}@${domain}`;
}

@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly auth: AuthService,
    private readonly trial: TrialService,
  ) {}

  async send(
    identifier: string,
    email?: string,
  ): Promise<{ needsEmail: boolean; maskedEmail?: string }> {
    const normalized = identifier.trim().toLowerCase();
    const type: 'EMAIL' | 'PHONE' = normalized.includes('@') ? 'EMAIL' : 'PHONE';

    // ── Phone OTP — sent via email relay (no Twilio required) ────────────────
    if (type === 'PHONE') {
      // Purge expired pending links.
      for (const [k, v] of PENDING_PHONE_EMAIL.entries()) {
        if (v.expiresAt < Date.now()) PENDING_PHONE_EMAIL.delete(k);
      }

      const existingUser = await this.prisma.user.findFirst({
        where: { phone: normalized },
        select: { email: true },
      });

      const realEmail =
        existingUser?.email && !existingUser.email.includes('@placeholder.cf')
          ? existingUser.email
          : null;

      // First-time phone user with no email provided — tell frontend to ask.
      if (!realEmail && !email) return { needsEmail: true };

      const sendTo = realEmail ?? email!;

      // Rate-limit on the phone identifier.
      const windowStart = new Date(Date.now() - OTP_EXPIRY_MS);
      const recentCount = await (this.prisma as any).otpCode.count({
        where: { identifier: normalized, createdAt: { gte: windowStart } },
      });
      if (recentCount >= OTP_MAX_PER_WINDOW) {
        throw new BadRequestException('Too many OTP requests. Please wait a few minutes.');
      }

      // Store pending link so verify() can create the full account.
      if (!realEmail && email) {
        PENDING_PHONE_EMAIL.set(normalized, {
          email: email.trim().toLowerCase(),
          expiresAt: Date.now() + OTP_EXPIRY_MS,
        });
      }

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const codeHash = await bcrypt.hash(code, 10);
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);
      await (this.prisma as any).otpCode.create({
        data: { identifier: normalized, codeHash, type, expiresAt },
      });

      await this.sendEmail(sendTo, code);
      return { needsEmail: false, maskedEmail: maskEmail(sendTo) };
    }

    // ── Email OTP ─────────────────────────────────────────────────────────────
    const windowStart = new Date(Date.now() - OTP_EXPIRY_MS);
    const recentCount = await (this.prisma as any).otpCode.count({
      where: { identifier: normalized, createdAt: { gte: windowStart } },
    });
    if (recentCount >= OTP_MAX_PER_WINDOW) {
      throw new BadRequestException('Too many OTP requests. Please wait a few minutes.');
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);
    await (this.prisma as any).otpCode.create({
      data: { identifier: normalized, codeHash, type, expiresAt },
    });
    await this.sendEmail(normalized, code);
    return { needsEmail: false };
  }

  async verify(
    identifier: string,
    code: string,
    meta: SessionMeta = {},
  ): Promise<{ accessToken: string; refreshToken: string; hasPassword: boolean }> {
    const normalized = identifier.trim().toLowerCase();
    const type: 'EMAIL' | 'PHONE' = normalized.includes('@') ? 'EMAIL' : 'PHONE';

    const otpRow = await (this.prisma as any).otpCode.findFirst({
      where: { identifier: normalized, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRow) throw new UnauthorizedException('Invalid or expired code');

    const valid = await bcrypt.compare(code, otpRow.codeHash);
    if (!valid) throw new UnauthorizedException('Invalid or expired code');

    await (this.prisma as any).otpCode.update({
      where: { id: otpRow.id },
      data: { usedAt: new Date() },
    });

    let user =
      type === 'EMAIL'
        ? await this.prisma.user.findUnique({
            where: { email: normalized },
            select: { id: true, email: true },
          })
        : await this.prisma.user.findFirst({
            where: { phone: normalized },
            select: { id: true, email: true },
          });

    if (!user) {
      const isFirst = (await this.prisma.user.count()) === 0;

      if (type === 'EMAIL') {
        const created = await this.prisma.user.create({
          data: {
            email: normalized,
            passwordHash: null,
            emailVerified: new Date(),
            role: isFirst ? 'OWNER' : 'MEMBER',
          },
          select: { id: true, email: true },
        });
        await this.trial
          .grantTrial(created.id, created.email, { ...meta, verificationMethod: 'otp' })
          .catch(() => undefined);
        user = created;
      } else {
        // Phone user — consume pending email link if available.
        const pending = PENDING_PHONE_EMAIL.get(normalized);
        const pendingEmail =
          pending && pending.expiresAt >= Date.now() ? pending.email : null;
        PENDING_PHONE_EMAIL.delete(normalized);

        if (pendingEmail) {
          // Check if an account already exists with that email → just link the phone.
          const byEmail = await this.prisma.user.findUnique({
            where: { email: pendingEmail },
            select: { id: true, email: true },
          });
          if (byEmail) {
            await this.prisma.user.update({
              where: { id: byEmail.id },
              data: { phone: normalized },
            });
            user = byEmail;
          } else {
            const created = await this.prisma.user.create({
              data: {
                email: pendingEmail,
                phone: normalized,
                passwordHash: null,
                emailVerified: new Date(),
                role: isFirst ? 'OWNER' : 'MEMBER',
              },
              select: { id: true, email: true },
            });
            await this.trial
              .grantTrial(created.id, created.email, { ...meta, verificationMethod: 'otp' })
              .catch(() => undefined);
            user = created;
          }
        } else {
          // No pending link — fall back to placeholder email.
          const placeholderEmail = `phone.${normalized.replace(/\D/g, '')}@placeholder.cf`;
          const created = await this.prisma.user.create({
            data: {
              email: placeholderEmail,
              phone: normalized,
              passwordHash: null,
              role: isFirst ? 'OWNER' : 'MEMBER',
            },
            select: { id: true, email: true },
          });
          await this.trial
            .grantTrial(created.id, created.email, { ...meta, verificationMethod: 'otp' })
            .catch(() => undefined);
          user = created;
        }
      }

      await this.prisma.auditLog.create({
        data: { userId: user.id, action: 'auth.otp_register', meta: { identifier: normalized, type } },
      });
    } else {
      // Existing phone user with placeholder email + pending real email → upgrade.
      if (type === 'PHONE' && user.email.includes('@placeholder.cf')) {
        const pending = PENDING_PHONE_EMAIL.get(normalized);
        if (pending && pending.expiresAt >= Date.now()) {
          PENDING_PHONE_EMAIL.delete(normalized);
          const emailNorm = pending.email;
          const taken = await this.prisma.user.findUnique({ where: { email: emailNorm } });
          if (!taken) {
            await this.prisma.user.update({
              where: { id: user.id },
              data: { email: emailNorm, emailVerified: new Date() },
            });
            user = { ...user, email: emailNorm };
          }
        }
      }

      await this.prisma.auditLog.create({
        data: { userId: user.id, action: 'auth.otp_login', meta: { identifier: normalized, type } },
      });
    }

    const tokens = await this.auth.issueSessionTokens(user.id, user.email, meta);
    const fullUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    return { ...tokens, hasPassword: fullUser?.passwordHash != null };
  }

  peekLastCode(identifier: string): string | null {
    if (process.env['NODE_ENV'] === 'production') return null;
    const entry = DEV_OTP_STORE.get(identifier.trim().toLowerCase());
    if (!entry || entry.expiresAt < Date.now()) return null;
    return entry.code;
  }

  private async sendEmail(to: string, code: string): Promise<void> {
    const html = `<div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:24px;border-radius:12px;border:1px solid #ede9f8"><h2 style="color:#7C3AED;margin-top:0">Sozialzync Sign-In Code</h2><p style="font-size:40px;font-weight:700;letter-spacing:10px;color:#1a1a2e;margin:16px 0">${code}</p><p style="color:#555;font-size:14px">This code expires in <strong>10 minutes</strong>. Never share it with anyone.</p><hr style="border:none;border-top:1px solid #ede9f8;margin:20px 0"><p style="color:#999;font-size:12px">If you didn't request this code, you can safely ignore this email.</p></div>`;
    const text = `Your Sozialzync sign-in code is: ${code}\n\nExpires in 10 minutes. Never share this code.`;
    const subject = 'Your Sozialzync sign-in code';

    // 1. Vercel relay — Railway calls Vercel (HTTPS 443) which then sends via SMTP/Resend.
    //    Needed because Railway blocks all outbound SMTP ports (587, 465) on its network.
    const relayUrl = this.config.get<string>('VERCEL_EMAIL_URL');
    const relaySecret = this.config.get<string>('INTERNAL_API_SECRET');
    if (relayUrl && relaySecret) {
      const resp = await fetch(relayUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-secret': relaySecret },
        body: JSON.stringify({ to, subject, html, text }),
      });
      if (resp.ok) return;
      const errBody = await resp.text().catch(() => '');
      if (resp.status !== 503) throw new Error(`Email relay failed ${resp.status}: ${errBody}`);
      console.warn(`[OTP] Vercel relay returned 503 — falling through to direct providers.`);
    }

    // 2. Brevo HTTP API — HTTPS port 443, no domain verification needed, works from Railway.
    const brevoKey = this.config.get<string>('BREVO_API_KEY');
    if (brevoKey) {
      const brevoFrom = this.config.get<string>('BREVO_FROM') ?? this.config.get<string>('SMTP_FROM') ?? 'noreply@sozialzync.com';
      const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { accept: 'application/json', 'api-key': brevoKey, 'content-type': 'application/json' },
        body: JSON.stringify({ sender: { name: 'Sozialzync', email: brevoFrom }, to: [{ email: to }], subject, textContent: text, htmlContent: html }),
      });
      if (resp.ok) return;
      const errBody = await resp.text().catch(() => '');
      throw new Error(`Brevo email failed ${resp.status}: ${errBody}`);
    }

    // 3. Resend SDK — falls through to next provider on domain-restriction errors (403).
    const resendKey = this.config.get<string>('RESEND_API_KEY');
    if (resendKey) {
      const resendFrom = this.config.get<string>('RESEND_FROM') ?? 'onboarding@resend.dev';
      const resend = new Resend(resendKey);
      const { error } = await resend.emails.send({ from: resendFrom, to, subject, html, text });
      if (!error) return;
      if ((error as unknown as { statusCode?: number }).statusCode !== 403) {
        throw new Error(`Resend email failed: ${error.message}`);
      }
      console.warn(`[OTP] Resend domain restriction for ${to} — falling back to SMTP.`);
    }

    // 4. SMTP (nodemailer) — Railway blocks all outbound SMTP; kept for non-Railway environments.
    const host = this.config.get<string>('SMTP_HOST');
    if (host) {
      const smtpUser = this.config.get<string>('SMTP_USER');
      const smtpFrom = this.config.get<string>('SMTP_FROM') ?? smtpUser ?? 'noreply@sozialzync.com';
      const smtpOpts = {
        host,
        port: Number(this.config.get('SMTP_PORT') ?? 587),
        secure: this.config.get('SMTP_SECURE') === 'true',
        auth: { user: smtpUser, pass: this.config.get<string>('SMTP_PASS') },
      };
      // @reason: family:4 forces IPv4 — Railway has no IPv6 routing; property absent from @types/nodemailer@8.0.1
      Object.assign(smtpOpts, { family: 4 });
      const transport = nodemailer.createTransport(smtpOpts);
      await transport.sendMail({ from: smtpFrom, to, subject, text, html });
      return;
    }

    // 5. Dev fallback — only allowed outside production.
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error(
        'Email OTP delivery unavailable: set BREVO_API_KEY in Railway environment variables.',
      );
    }
    DEV_OTP_STORE.set(to, { code, expiresAt: Date.now() + OTP_EXPIRY_MS });
    console.warn(
      `\n╔══════════════════════════════════════════════════════╗\n` +
      `║  [OTP DEV] No email provider configured              ║\n` +
      `║  To: ${to.padEnd(46)}║\n` +
      `║  Code: ${code.padEnd(44)}║\n` +
      `║  → GET /api/v1/auth/otp/dev-peek?identifier=${to.padEnd(9)}║\n` +
      `╚══════════════════════════════════════════════════════╝\n`,
    );
  }

  private async sendSms(to: string, code: string): Promise<void> {
    const sid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const token = this.config.get<string>('TWILIO_AUTH_TOKEN');
    const from = this.config.get<string>('TWILIO_FROM');

    if (!sid || !token || !from) {
      if (process.env['NODE_ENV'] === 'production') {
        throw new Error(
          'SMS OTP delivery unavailable: set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM in your environment.',
        );
      }
      DEV_OTP_STORE.set(to, { code, expiresAt: Date.now() + OTP_EXPIRY_MS });
      console.warn(
        `\n╔══════════════════════════════════════════════════════╗\n` +
        `║  [OTP DEV] No SMS provider configured                ║\n` +
        `║  To: ${to.padEnd(46)}║\n` +
        `║  OTP: ${code.padEnd(44)}║\n` +
        `║  → GET /api/v1/auth/otp/dev-peek?identifier=${to.padEnd(9)}║\n` +
        `╚══════════════════════════════════════════════════════╝\n`,
      );
      return;
    }

    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: to,
          From: from,
          Body: `Your Sozialzync sign-in code is ${code}. Valid for 10 minutes. Never share this.`,
        }).toString(),
      },
    );
    if (!res.ok) throw new Error(`SMS send failed: ${res.status}`);
  }
}
