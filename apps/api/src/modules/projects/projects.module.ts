import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { DemoSeedService } from './demo-seed.service';

@Module({
  providers: [ProjectsService, DemoSeedService],
  controllers: [ProjectsController],
  exports: [ProjectsService],
})
export class ProjectsModule {}
