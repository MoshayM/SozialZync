import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { AdminController } from './admin.controller';

@Module({
  imports: [NotificationsModule],
  providers: [BillingService],
  controllers: [BillingController, AdminController],
  exports: [BillingService],
})
export class BillingModule {}
