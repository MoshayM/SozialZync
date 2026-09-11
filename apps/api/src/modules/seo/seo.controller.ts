import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TierRateLimit } from '../../common/guards/rate-limit.guard';
import { SeoService } from './seo.service';

class SeoDto {
  @IsString() title!: string;
  @IsString() description!: string;
  @IsOptional() @IsString() niche?: string;
}

@TierRateLimit({ bucket: 'seo-optimize', windowSecs: 3600, limits: { FREE: 10, STARTER: 30, PRO: 100, AGENCY: 300, default: 10 } })
@ApiTags('seo')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('seo')
export class SeoController {
  constructor(private readonly svc: SeoService) {}

  @Post('optimize')
  optimize(@Body() dto: SeoDto) {
    return this.svc.optimize(dto.title, dto.description, dto.niche);
  }
}
