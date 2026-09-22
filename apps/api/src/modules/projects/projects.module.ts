import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { MyContentController } from './my-content.controller';
import { DemoSeedService } from './demo-seed.service';
import { AdRevenueService } from './ad-revenue.service';

@Module({
  providers: [ProjectsService, DemoSeedService, AdRevenueService],
  controllers: [ProjectsController, MyContentController],
  exports: [ProjectsService, AdRevenueService, DemoSeedService],
})
export class ProjectsModule {}
