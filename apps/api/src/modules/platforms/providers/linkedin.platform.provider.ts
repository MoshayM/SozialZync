import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { IPlatformProvider, PublishOptions, PublishResult, ConnectionStatus } from '../platform.types';

@Injectable()
export class LinkedInPlatformProvider implements IPlatformProvider {
  readonly platformId = 'linkedin';
  readonly name = 'LinkedIn';

  constructor(private readonly prisma: PrismaService) {}

  async getConnectionStatus(userId: string): Promise<ConnectionStatus> {
    const conn = await this.prisma.platformConnection.findUnique({
      where: { userId_platformId: { userId, platformId: 'linkedin' } },
      select: { accountName: true, accountId: true },
    });
    if (!conn) return { connected: false };
    return { connected: true, accountName: conn.accountName ?? undefined, accountId: conn.accountId };
  }

  async getOAuthUrl(userId: string, returnUrl: string): Promise<string> {
    const apiBase = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4007/api/v1';
    return `${apiBase}/platforms/linkedin/auth?userId=${encodeURIComponent(userId)}&returnUrl=${encodeURIComponent(returnUrl)}`;
  }

  async disconnect(userId: string): Promise<void> {
    await this.prisma.platformConnection.deleteMany({ where: { userId, platformId: 'linkedin' } });
  }

  async publish(_userId: string, _opts: PublishOptions): Promise<PublishResult> {
    throw new Error('LinkedIn publishing not yet implemented');
  }

  async schedule(_userId: string, _opts: PublishOptions & { scheduledAt: Date }): Promise<PublishResult> {
    throw new Error('LinkedIn scheduling not yet implemented');
  }

  validate(opts: PublishOptions): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!opts.title) errors.push('Title is required');
    if (!opts.videoFilePath) errors.push('Video or image file is required');
    return { valid: errors.length === 0, errors };
  }
}
