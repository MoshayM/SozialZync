import { Module } from '@nestjs/common';
import { ProviderConfigController } from './provider-config.controller';
import { ProviderConfigService } from './provider-config.service';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ProviderConfigController],
  providers: [ProviderConfigService],
  exports: [ProviderConfigService],
})
export class ProviderConfigModule {}
