import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { TrialExpiryJob } from './trial-expiry.job';
import { LotExpiryJob } from './lot-expiry.job';
import { PushService } from './push.service';
import { PushController } from './push.controller';

@Module({
  providers: [NotificationsService, TrialExpiryJob, LotExpiryJob, PushService],
  controllers: [NotificationsController, PushController],
  exports: [NotificationsService, PushService],
})
export class NotificationsModule {}
