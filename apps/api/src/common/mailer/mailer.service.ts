import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  constructor(private readonly config: ConfigService) {}

  private getTransport() {
    const host = this.config.get<string>('SMTP_HOST');
    const port = Number(this.config.get<string>('SMTP_PORT') ?? 587);
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const from = this.config.get<string>('SMTP_FROM') ?? user;

    if (!host || !user || !pass) return null;

    return {
      transport: nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        // @reason: family:4 forces IPv4 — Railway has no IPv6 routing to smtp.gmail.com
        family: 4,
        auth: { user, pass },
      } as nodemailer.TransportOptions & { family?: number }),
      from,
    };
  }

  async sendPasswordReset(to: string, name: string, resetUrl: string): Promise<boolean> {
    const t = this.getTransport();
    if (!t) {
      this.logger.warn(`[MAILER] SMTP not configured — reset URL for ${to}: ${resetUrl}`);
      return false;
    }
    try {
      await t.transport.sendMail({
        from: t.from,
        to,
        subject: 'Reset your Sozialzynk password',
        text: `Hi ${name},\n\nClick this link to reset your password (valid for 1 hour):\n${resetUrl}\n\nIf you didn't request this, ignore this email.`,
        html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
  <h2 style="color:#7C3AED;margin-top:0">Reset your password</h2>
  <p style="color:#333">Hi ${name},</p>
  <p style="color:#555">Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
  <a href="${resetUrl}" style="display:inline-block;margin:16px 0;padding:12px 28px;background:linear-gradient(135deg,#6D4AE0,#7c5ae8);color:#fff;text-decoration:none;border-radius:12px;font-weight:600">
    Reset Password
  </a>
  <p style="color:#888;font-size:12px;margin-top:24px">If you didn't request a password reset, you can safely ignore this email.</p>
  <p style="color:#bbb;font-size:11px">Sozialzynk · AI Social Media Operating System</p>
</div>`,
      });
      this.logger.log(`[MAILER] Reset email sent to ${to}`);
      return true;
    } catch (err) {
      this.logger.error(`[MAILER] Failed to send reset email to ${to}: ${(err as Error).message}`);
      return false;
    }
  }
}
