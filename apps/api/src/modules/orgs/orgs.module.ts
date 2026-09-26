import { Module } from '@nestjs/common';
import { OrgsService } from './orgs.service';
import { OrgsController } from './orgs.controller';
import { BudgetRolloverJob } from './budget-rollover.job';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [OrgsService, BudgetRolloverJob],
  controllers: [OrgsController],
  exports: [OrgsService],
})
export class OrgsModule {}
