import { Injectable, Logger } from '@nestjs/common';
import { IPlatformProvider, ConnectionStatus } from './platform.types';
import { YouTubePlatformProvider } from './providers/youtube.platform.provider';
import { InstagramPlatformProvider } from './providers/instagram.platform.provider';
import { TikTokPlatformProvider } from './providers/tiktok.platform.provider';
import { FacebookPlatformProvider } from './providers/facebook.platform.provider';
import { LinkedInPlatformProvider } from './providers/linkedin.platform.provider';
import { XPlatformProvider } from './providers/x.platform.provider';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class PlatformRegistryService {
  private readonly logger = new Logger(PlatformRegistryService.name);
  private readonly providers = new Map<string, IPlatformProvider>();

  constructor(
    private readonly youtube: YouTubePlatformProvider,
    private readonly instagram: InstagramPlatformProvider,
    private readonly tiktok: TikTokPlatformProvider,
    private readonly facebook: FacebookPlatformProvider,
    private readonly linkedin: LinkedInPlatformProvider,
    private readonly x: XPlatformProvider,
    private readonly prisma: PrismaService,
  ) {
    [youtube, instagram, tiktok, facebook, linkedin, x].forEach(p => this.register(p));
  }

  private register(provider: IPlatformProvider): void {
    this.providers.set(provider.platformId, provider);
    this.logger.log(`Registered platform provider: ${provider.name}`);
  }

  getProvider(platformId: string): IPlatformProvider | undefined {
    return this.providers.get(platformId);
  }

  listProviders(): Array<{ platformId: string; name: string }> {
    return Array.from(this.providers.values()).map(p => ({ platformId: p.platformId, name: p.name }));
  }

  async getAllConnectionStatuses(userId: string): Promise<Record<string, ConnectionStatus>> {
    const [statusEntries, watchRows] = await Promise.all([
      Promise.all(
        Array.from(this.providers.values()).map(async p => {
          try {
            return [p.platformId, await p.getConnectionStatus(userId)] as const;
          } catch {
            return [p.platformId, { connected: false }] as const;
          }
        }),
      ),
      this.prisma.platformConnection.findMany({
        where: { userId, readOnly: true },
        select: { id: true, platformId: true, accountId: true, accountName: true, createdAt: true },
      }),
    ]);

    const result: Record<string, ConnectionStatus> = {};
    for (const [platformId, status] of statusEntries) {
      result[platformId] = status;
    }

    for (const row of watchRows) {
      const entry = result[row.platformId] ?? { connected: false };
      entry.watches = [
        ...(entry.watches ?? []),
        { id: row.id, handle: row.accountId, accountName: row.accountName ?? undefined, addedAt: row.createdAt },
      ];
      result[row.platformId] = entry;
    }

    return result;
  }
}
