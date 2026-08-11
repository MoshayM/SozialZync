import { Module } from '@nestjs/common';
import { PlatformRegistryService } from './platform-registry.service';
import { PlatformsController } from './platforms.controller';
import { InstagramOAuthController } from './instagram-oauth.controller';
import { FacebookOAuthController } from './facebook-oauth.controller';
import { YouTubePlatformProvider } from './providers/youtube.platform.provider';
import { InstagramPlatformProvider } from './providers/instagram.platform.provider';
import { TikTokPlatformProvider } from './providers/tiktok.platform.provider';
import { FacebookPlatformProvider } from './providers/facebook.platform.provider';
import { LinkedInPlatformProvider } from './providers/linkedin.platform.provider';
import { XPlatformProvider } from './providers/x.platform.provider';
import { ChannelsModule } from '../channels/channels.module';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [ChannelsModule, PrismaModule],
  providers: [
    PlatformRegistryService,
    YouTubePlatformProvider,
    InstagramPlatformProvider,
    TikTokPlatformProvider,
    FacebookPlatformProvider,
    LinkedInPlatformProvider,
    XPlatformProvider,
  ],
  controllers: [PlatformsController, InstagramOAuthController, FacebookOAuthController],
  exports: [PlatformRegistryService],
})
export class PlatformsModule {}
