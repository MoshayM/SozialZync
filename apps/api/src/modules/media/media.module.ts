import { Module } from '@nestjs/common';
import { MediaService } from './media.service';
import { StorageService } from './storage.service';
import { R2StorageService } from './r2-storage.service';
import { ExportsService } from './exports.service';
import { MediaController } from './media.controller';
import { ImageGenerationService } from './image-generation.service';
import { ImageGenerationController } from './image-generation.controller';
import { VideoGenerationService } from './video-generation.service';
import { VideoGenerationController } from './video-generation.controller';
import { ImageExternalService } from './image-external.service';
import { ThumbnailService } from './thumbnail.service';
import { MediaLibraryController } from './media-library.controller';

@Module({
  controllers: [MediaController, ImageGenerationController, VideoGenerationController, MediaLibraryController],
  providers: [
    MediaService,
    ExportsService,
    ImageGenerationService,
    VideoGenerationService,
    ImageExternalService,
    ThumbnailService,
    {
      provide: StorageService,
      useFactory: (): StorageService =>
        process.env['STORAGE_BACKEND'] === 'r2'
          ? new R2StorageService()
          : new StorageService(),
    },
  ],
  exports: [MediaService, StorageService, ExportsService, ImageGenerationService, VideoGenerationService, ImageExternalService, ThumbnailService],
})
export class MediaModule {}
