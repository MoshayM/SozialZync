import { Module } from '@nestjs/common';
import { UpgradeService } from './upgrade.service';
import { UpgradeController } from './upgrade.controller';

@Module({
  providers: [UpgradeService],
  controllers: [UpgradeController],
})
export class UpgradeModule {}
