import { Module } from '@nestjs/common';
import { PlatformRegistryService } from './platform-registry.service';
import { PlatformsController } from './platforms.controller';
import { YouTubePlatformProvider } from './providers/youtube.platform.provider';
import { ChannelsModule } from '../channels/channels.module';

@Module({
  imports: [ChannelsModule],
  providers: [PlatformRegistryService, YouTubePlatformProvider],
  controllers: [PlatformsController],
  exports: [PlatformRegistryService],
})
export class PlatformsModule {}
