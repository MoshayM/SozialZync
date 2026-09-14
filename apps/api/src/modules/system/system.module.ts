import { Module } from '@nestjs/common';
import { SystemController } from './system.controller';
import { SystemService } from './system.service';
import { StorageService } from './storage.service';
import { ProviderHealthController } from './provider-health.controller';
import { SystemKeyService } from './system-key.service';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SystemController, ProviderHealthController],
  providers: [SystemService, StorageService, SystemKeyService],
  exports: [SystemService, StorageService, SystemKeyService],
})
export class SystemModule {}
