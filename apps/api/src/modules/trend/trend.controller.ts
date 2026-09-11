import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TierRateLimit } from '../../common/guards/rate-limit.guard';
import { TrendService } from './trend.service';

class TrendDto {
  @IsString() niche!: string;
  @IsOptional() @IsNumber() channelSize?: number;
}

class GapsDto {
  @IsString() niche!: string;
}

@TierRateLimit({ bucket: 'trend-analyze', windowSecs: 3600, limits: { FREE: 5, STARTER: 20, PRO: 60, AGENCY: 150, default: 5 } })
@ApiTags('trends')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('trends')
export class TrendController {
  constructor(private readonly svc: TrendService) {}

  @Post('analyze')
  analyze(@Body() dto: TrendDto) {
    return this.svc.analyze(dto.niche, dto.channelSize);
  }

  @Get('gaps')
  gaps(@Query() dto: GapsDto) {
    return this.svc.gapsAnalysis(dto.niche);
  }
}
