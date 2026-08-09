import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ReferralService } from './referral.service';
import type { Request } from 'express';

interface AuthReq extends Request { user: { id: string } }

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
  getOrCreateCode(@Req() req: AuthReq) {
    return this.svc.getOrCreateCode(req.user.id);
  }

  @Post('redeem')
  redeem(@Body() body: RedeemDto, @Req() req: AuthReq) {
    return this.svc.redeem(body.code, req.user.id);
  }

  @Get('earnings')
  earnings(@Req() req: AuthReq) {
    return this.svc.getEarnings(req.user.id);
  }

  @Get('leaderboard')
  leaderboard() {
    return this.svc.getLeaderboard();
  }
}
