import { Module } from '@nestjs/common';
import { ContentService } from './content.service';
import { ContentController } from './content.controller';
import { WebSearchService } from './web-search.service';

@Module({
  providers: [ContentService, WebSearchService],
  controllers: [ContentController],
  exports: [ContentService, WebSearchService],
})
export class ContentModule {}
