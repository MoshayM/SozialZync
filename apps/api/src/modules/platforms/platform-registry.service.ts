import { Injectable, Logger } from '@nestjs/common';
import { IPlatformProvider, ConnectionStatus } from './platform.types';
import { YouTubePlatformProvider } from './providers/youtube.platform.provider';
import { InstagramPlatformProvider } from './providers/instagram.platform.provider';
import { TikTokPlatformProvider } from './providers/tiktok.platform.provider';
import { FacebookPlatformProvider } from './providers/facebook.platform.provider';
import { LinkedInPlatformProvider } from './providers/linkedin.platform.provider';
import { XPlatformProvider } from './providers/x.platform.provider';

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
    const result: Record<string, ConnectionStatus> = {};
    await Promise.all(
      Array.from(this.providers.values()).map(async p => {
        try {
          result[p.platformId] = await p.getConnectionStatus(userId);
        } catch {
          result[p.platformId] = { connected: false };
        }
      }),
    );
    return result;
  }
}
