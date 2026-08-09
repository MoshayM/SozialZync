import { Module } from '@nestjs/common';
import { AutonomyService } from './autonomy.service';
import { AutonomyController } from './autonomy.controller';
import { TrendModule } from '../trend/trend.module';
import { JobsModule } from '../jobs/jobs.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ChannelsModule } from '../channels/channels.module';

@Module({
  imports: [TrendModule, JobsModule, NotificationsModule, ChannelsModule],
  providers: [AutonomyService],
  controllers: [AutonomyController],
  exports: [AutonomyService],
})
export class AutonomyModule {}
