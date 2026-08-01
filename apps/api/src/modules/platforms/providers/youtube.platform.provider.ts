import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ChannelsService } from '../../channels/channels.service';
import { IPlatformProvider, PublishOptions, PublishResult, ConnectionStatus } from '../platform.types';

@Injectable()
export class YouTubePlatformProvider implements IPlatformProvider {
  readonly platformId = 'youtube';
  readonly name = 'YouTube';

  constructor(
    private readonly prisma: PrismaService,
    private readonly channels: ChannelsService,
  ) {}

  async getConnectionStatus(userId: string): Promise<ConnectionStatus> {
    const channel = await this.prisma.channel.findFirst({
      where: { userId, active: true },
      select: { id: true, title: true, youtubeChannelId: true, tokenExpiresAt: true },
    });
    if (!channel) return { connected: false };
    return {
      connected: true,
      accountName: channel.title ?? undefined,
      accountId: channel.youtubeChannelId ?? undefined,
      expiresAt: channel.tokenExpiresAt ?? undefined,
    };
  }

  async getOAuthUrl(userId: string, returnUrl: string): Promise<string> {
    // ChannelsService.getAuthUrl(redirectUri, userId, access, returnTo)
    return this.channels.getAuthUrl(returnUrl, userId, 'PUBLISH', returnUrl);
  }

  async disconnect(userId: string): Promise<void> {
    await this.prisma.channel.updateMany({ where: { userId }, data: { active: false } });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async publish(_userId: string, _opts: PublishOptions): Promise<PublishResult> {
    // Delegates to existing YouTube publish pipeline
    throw new Error('Use existing VideoPublishJob for YouTube publishing');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async schedule(_userId: string, _opts: PublishOptions & { scheduledAt: Date }): Promise<PublishResult> {
    throw new Error('Use existing scheduler for YouTube publishing');
  }

  validate(opts: PublishOptions): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!opts.title) errors.push('Title is required');
    if (!opts.videoFilePath) errors.push('Video file is required');
    return { valid: errors.length === 0, errors };
  }
}
