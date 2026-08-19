import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { BenchmarkService } from './benchmark.service';
import { AutonomyModule } from '../autonomy/autonomy.module';

@Module({
  imports: [AutonomyModule],
  providers: [AnalyticsService, BenchmarkService],
  controllers: [AnalyticsController],
  exports: [AnalyticsService, BenchmarkService],
})
export class AnalyticsModule {}
