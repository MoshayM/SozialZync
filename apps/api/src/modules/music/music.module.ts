import { Module } from '@nestjs/common';
import { MusicController } from './music.controller';
import { MusicService } from './music.service';
import { MusicExternalService } from './music-external.service';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MusicController],
  providers: [MusicService, MusicExternalService],
  exports: [MusicService, MusicExternalService],
})
export class MusicModule {}
