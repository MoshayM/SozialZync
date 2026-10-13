import { Module } from '@nestjs/common';
import { SystemController } from './system.controller';
import { SystemService } from './system.service';
import { StorageService } from './storage.service';
import { ProviderHealthController } from './provider-health.controller';
import { SystemKeyService } from './system-key.service';
import { CreditMonitorService } from './credit-monitor.service';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SystemController, ProviderHealthController],
  providers: [SystemService, StorageService, SystemKeyService, CreditMonitorService],
  exports: [SystemService, StorageService, SystemKeyService, CreditMonitorService],
})
export class SystemModule {}
