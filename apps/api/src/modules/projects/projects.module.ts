import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { DemoSeedService } from './demo-seed.service';
import { AdRevenueService } from './ad-revenue.service';

@Module({
  providers: [ProjectsService, DemoSeedService, AdRevenueService],
  controllers: [ProjectsController],
  exports: [ProjectsService, AdRevenueService],
})
export class ProjectsModule {}
