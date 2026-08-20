import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/prisma/prisma.service';

const EXPIRY_MS = 60 * 60 * 1000; // 1 hour

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async sendResetEmail(email: string): Promise<void> {
    const normalized = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalized },
      select: { id: true, email: true, name: true },
    });
    // Always return 204 — don't reveal whether account exists
    if (!user) return;

    // @reason: passwordResetToken added via db push; TS types not regenerated while API is running
    const prt = (this.prisma as any).passwordResetToken;

    // Invalidate any existing unused tokens for this user
    await prt.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + EXPIRY_MS);

    await prt.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const baseUrl = this.config.get<string>('NEXT_PUBLIC_APP_URL') ?? 'http://localhost:3007';
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    await this.sendEmail(user.email, user.name ?? 'Creator', resetUrl);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    // @reason: passwordResetToken added via db push; TS types not regenerated while API is running
    const prt = (this.prisma as any).passwordResetToken;
    const row = await prt.findUnique({ where: { tokenHash } });

    if (!row || row.usedAt || row.expiresAt < new Date()) {
      throw new BadRequestException('Reset link is invalid or has expired. Please request a new one.');
    }

    if (newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters.');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: row.userId },
        data: { passwordHash },
      }),
      prt.update({
        where: { tokenHash },
        data: { usedAt: new Date() },
      }),
    ]);
  }

  private sendEmail(to: string, _name: string, resetUrl: string): void {
    // No email provider configured — log the reset URL in dev for manual testing.
    console.log(`\n[PASSWORD RESET DEV] Reset URL for ${to}:\n${resetUrl}\n`);
  }
}
