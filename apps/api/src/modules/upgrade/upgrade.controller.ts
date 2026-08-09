import { Controller, Get, Post, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UpgradeService } from './upgrade.service';
import type { Request } from 'express';

interface AuthReq extends Request { user: { id: string } }

@ApiTags('upgrade')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('upgrade')
export class UpgradeController {
  constructor(private readonly svc: UpgradeService) {}

  @Get('recommendations')
  getRecommendations(@Req() req: AuthReq) {
    return this.svc.getRecommendations(req.user.id);
  }

  @Post('recommendations/:id/dismiss')
  dismiss(@Param('id') id: string, @Req() req: AuthReq) {
    return this.svc.dismiss(id, req.user.id);
  }
}
