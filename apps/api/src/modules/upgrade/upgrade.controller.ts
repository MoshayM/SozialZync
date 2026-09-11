import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';
import { UpgradeService } from './upgrade.service';

@ApiTags('upgrade')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('upgrade')
export class UpgradeController {
  constructor(private readonly svc: UpgradeService) {}

  @Get('recommendations')
  getRecommendations(@CurrentUser() user: JwtPayload) {
    return this.svc.getRecommendations(user.sub);
  }

  @Post('recommendations/:id/dismiss')
  dismiss(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.svc.dismiss(id, user.sub);
  }
}
