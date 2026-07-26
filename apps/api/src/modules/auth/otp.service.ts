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

@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly auth: AuthService,
    private readonly trial: TrialService,
  ) {}

  async send(identifier: string): Promise<void> {
    const normalized = identifier.trim().toLowerCase();
    const type: 'EMAIL' | 'PHONE' = normalized.includes('@') ? 'EMAIL' : 'PHONE';

    const windowStart = new Date(Date.now() - OTP_EXPIRY_MS);
    const recentCount = await (this.prisma as any).otpCode.count({
      where: { identifier: normalized, createdAt: { gte: windowStart } },
    });
    if (recentCount >= OTP_MAX_PER_WINDOW) {
      throw new BadRequestException('Too many OTP requests. Please wait a few minutes.');
    }

    // No userExists gate — OTP sign-in works for new users too.
    // If the account doesn't exist yet, verify() will auto-create it.

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

    await (this.prisma as any).otpCode.create({
      data: { identifier: normalized, codeHash, type, expiresAt },
    });

    if (type === 'EMAIL') {
      await this.sendEmail(normalized, code);
    } else {
      await this.sendSms(normalized, code);
    }
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
      // First-time OTP sign-in — auto-create account using identifier as minimum info.
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
        // Phone-only account: synthesise a unique placeholder email so the
        // NOT-NULL email constraint is satisfied. The user can add a real email later.
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

      await this.prisma.auditLog.create({
        data: { userId: user.id, action: 'auth.otp_register', meta: { identifier: normalized, type } },
      });
    } else {
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

  /**
   * Returns the last OTP code sent to `identifier` — only works when
   * NODE_ENV !== 'production'. Used by the /auth/otp/dev-peek endpoint so
   * developers can sign in without configuring an email provider.
   */
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

    // 1. Resend SDK — falls through to next provider on domain-restriction errors (403).
    const resendKey = this.config.get<string>('RESEND_API_KEY');
    if (resendKey) {
      const resendFrom = this.config.get<string>('RESEND_FROM') ?? 'onboarding@resend.dev';
      const resend = new Resend(resendKey);
      const { error } = await resend.emails.send({ from: resendFrom, to, subject, html, text });
      if (!error) return;
      // 403 = Resend testing-mode restriction (unverified domain) — fall through.
      if ((error as unknown as { statusCode?: number }).statusCode !== 403) {
        throw new Error(`Resend email failed: ${error.message}`);
      }
      console.warn(`[OTP] Resend domain restriction for ${to} — falling back to SMTP.`);
    }

    // 3. SMTP (nodemailer) — may be blocked on some cloud hosts (Railway blocks port 587).
    const host = this.config.get<string>('SMTP_HOST');
    if (host) {
      const smtpUser = this.config.get<string>('SMTP_USER');
      const smtpFrom = this.config.get<string>('SMTP_FROM') ?? smtpUser ?? 'noreply@sozialzync.com';
      const transport = nodemailer.createTransport({
        host,
        port: Number(this.config.get('SMTP_PORT') ?? 587),
        secure: this.config.get('SMTP_SECURE') === 'true',
        family: 4, // force IPv4 — Railway does not support IPv6
        auth: {
          user: smtpUser,
          pass: this.config.get<string>('SMTP_PASS'),
        },
      });
      await transport.sendMail({ from: smtpFrom, to, subject, text, html });
      return;
    }

    // 3. Dev fallback — only allowed outside production.
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error(
        'Email OTP delivery unavailable: verify a domain at resend.com/domains or set SMTP_HOST in your environment.',
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
      // Dev fallback — store for /auth/otp/dev-peek and log visibly.
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
