import { Module } from '@nestjs/common';
import { WalletModule } from '../wallet/wallet.module';
import { ReferralService } from './referral.service';
import { ReferralController } from './referral.controller';

@Module({
  imports: [WalletModule],
  providers: [ReferralService],
  controllers: [ReferralController],
  exports: [ReferralService],
})
export class ReferralModule {}
