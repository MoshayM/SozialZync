import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  constructor(private readonly config: ConfigService) {}

  // ── Resend HTTP API ───────────────────────────────────────────────────────────

  private async sendViaResend(to: string, subject: string, html: string, text: string): Promise<boolean> {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const from = this.config.get<string>('RESEND_FROM') ?? 'onboarding@resend.dev';
    if (!apiKey) return false;

    try {
      await axios.post(
        'https://api.resend.com/emails',
        { from, to, subject, html, text },
        { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' } },
      );
      this.logger.log(`[MAILER] Reset email sent via Resend to ${to}`);
      return true;
    } catch (err) {
      const msg = axios.isAxiosError(err) ? JSON.stringify(err.response?.data) : (err as Error).message;
      this.logger.error(`[MAILER] Resend failed for ${to}: ${msg}`);
      return false;
    }
  }

  // ── Nodemailer SMTP fallback ──────────────────────────────────────────────────

  private async sendViaSmtp(to: string, subject: string, html: string, text: string): Promise<boolean> {
    const host = this.config.get<string>('SMTP_HOST');
    const port = Number(this.config.get<string>('SMTP_PORT') ?? 587);
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const from = this.config.get<string>('SMTP_FROM') ?? user;

    if (!host || !user || !pass) return false;

    try {
      const transport = nodemailer.createTransport({
        host, port, secure: port === 465,
        // @reason: family:4 forces IPv4 — Railway has no IPv6 route to smtp.gmail.com
        family: 4,
        auth: { user, pass },
      } as nodemailer.TransportOptions & { family?: number });

      await transport.sendMail({ from, to, subject, html, text });
      this.logger.log(`[MAILER] Reset email sent via SMTP to ${to}`);
      return true;
    } catch (err) {
      this.logger.error(`[MAILER] SMTP failed for ${to}: ${(err as Error).message}`);
      return false;
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────────

  async sendPasswordReset(to: string, name: string, resetUrl: string): Promise<boolean> {
    const subject = 'Reset your Sozialzynk password';
    const text = `Hi ${name},\n\nClick this link to reset your password (valid for 1 hour):\n${resetUrl}\n\nIf you didn't request this, ignore this email.`;
    const html = `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
  <h2 style="color:#7C3AED;margin-top:0">Reset your password</h2>
  <p style="color:#333">Hi ${name},</p>
  <p style="color:#555">Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
  <a href="${resetUrl}" style="display:inline-block;margin:16px 0;padding:12px 28px;background:linear-gradient(135deg,#6D4AE0,#7c5ae8);color:#fff;text-decoration:none;border-radius:12px;font-weight:600">
    Reset Password
  </a>
  <p style="color:#888;font-size:12px;margin-top:24px">If you didn't request a password reset, you can safely ignore this email.</p>
  <p style="color:#bbb;font-size:11px">Sozialzynk · AI Social Media Operating System</p>
</div>`;

    // Prefer Resend (HTTPS, no port restrictions) over SMTP
    const resendKey = this.config.get<string>('RESEND_API_KEY');
    if (resendKey) {
      const sent = await this.sendViaResend(to, subject, html, text);
      if (sent) return true;
      this.logger.warn(`[MAILER] Resend failed, falling back to SMTP for ${to}`);
    }

    const smtpSent = await this.sendViaSmtp(to, subject, html, text);
    if (!smtpSent) {
      this.logger.warn(`[MAILER] All delivery methods failed — reset URL for ${to}: ${resetUrl}`);
    }
    return smtpSent;
  }
}
