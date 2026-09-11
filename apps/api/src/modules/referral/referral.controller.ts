import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';
import { ReferralService } from './referral.service';

class RedeemDto {
  @IsString() code!: string;
}

@ApiTags('referral')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('referral')
export class ReferralController {
  constructor(private readonly svc: ReferralService) {}

  @Post('code')
  getOrCreateCode(@CurrentUser() user: JwtPayload) {
    return this.svc.getOrCreateCode(user.sub);
  }

  @Post('redeem')
  redeem(@Body() body: RedeemDto, @CurrentUser() user: JwtPayload) {
    return this.svc.redeem(body.code, user.sub);
  }

  @Get('earnings')
  earnings(@CurrentUser() user: JwtPayload) {
    return this.svc.getEarnings(user.sub);
  }

  @Get('leaderboard')
  leaderboard() {
    return this.svc.getLeaderboard();
  }
}
