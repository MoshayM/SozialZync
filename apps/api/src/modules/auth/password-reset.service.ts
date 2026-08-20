import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/prisma/prisma.service';

const EXPIRY_SEC = 60 * 60; // 1 hour

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // ── HMAC-signed token helpers ────────────────────────────────────────────────
  // Token format: base64url( JSON { sub, exp } ) + '.' + base64url( HMAC-SHA256 )
  // No DB table required — expiry and integrity are embedded in the token itself.

  private secret(): string {
    return this.config.get<string>('JWT_SECRET') ?? 'dev-reset-secret';
  }

  private signToken(userId: string): string {
    const payload = Buffer.from(
      JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + EXPIRY_SEC }),
    ).toString('base64url');
    const sig = crypto
      .createHmac('sha256', this.secret())
      .update(payload)
      .digest('base64url');
    return `${payload}.${sig}`;
  }

  private verifyToken(token: string): { userId: string } {
    const [payload, sig] = token.split('.');
    if (!payload || !sig) throw new BadRequestException('Reset link is invalid or has expired.');

    const expected = crypto
      .createHmac('sha256', this.secret())
      .update(payload)
      .digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      throw new BadRequestException('Reset link is invalid or has expired.');
    }

    const { sub, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString()) as {
      sub: string;
      exp: number;
    };
    if (Math.floor(Date.now() / 1000) > exp) {
      throw new BadRequestException('Reset link has expired. Please request a new one.');
    }
    return { userId: sub };
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  /**
   * Generate a password reset token and return the reset URL directly.
   * No email is sent — the URL is returned in the API response for the
   * frontend to display on-screen. Returns null when the email is not registered.
   */
  async requestResetToken(email: string): Promise<{ resetUrl: string | null }> {
    const normalized = email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: normalized, mode: 'insensitive' } },
      select: { id: true },
    });
    if (!user) return { resetUrl: null };

    const token = this.signToken(user.id);
    const baseUrl =
      this.config.get<string>('NEXT_PUBLIC_APP_URL') ?? 'http://localhost:3007';
    const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;

    console.log(`[PASSWORD RESET] ${normalized} → ${resetUrl}`);
    return { resetUrl };
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const { userId } = this.verifyToken(token);

    if (newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new BadRequestException('Reset link is invalid or has expired.');

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }
}
