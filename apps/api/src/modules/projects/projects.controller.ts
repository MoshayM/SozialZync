import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';
import { ProjectsService } from './projects.service';
import { AdRevenueService } from './ad-revenue.service';
import { roleHasPermission } from '../../common/rbac';
import { ForbiddenException } from '@nestjs/common';

class CreateProjectDto {
  @IsOptional() @IsString() channelId?: string;
  @IsString() title!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() niche?: string;
  @IsOptional() @IsString() targetLang?: string;
  /** Phase 5 §10: bill agent-job spend to this org; empty string clears. */
  @IsOptional() @IsString() billingOrgId?: string;
  @IsOptional() @IsString() contentFormat?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) platforms?: string[];
}

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly svc: ProjectsService,
    private readonly adRevenue: AdRevenueService,
  ) {}

  /** Public demo/advertisement projects — visible to all users, no auth required. */
  @Public()
  @Get('browse')
  listPublic(@Query('limit') limit?: string) {
    return this.svc.listPublic({ limit: limit ? parseInt(limit, 10) : undefined });
  }

  /** Record a view on a public project (no auth required — idempotent, fire-and-forget). */
  @Public()
  @Post('browse/:id/view')
  @HttpCode(HttpStatus.NO_CONTENT)
  async trackView(@Param('id') id: string) {
    await this.adRevenue.trackView(id).catch(() => undefined);
  }

  /** Creator: get ad revenue stats for their own projects. */
  @Get('ad-revenue/stats')
  getMyAdRevenueStats(@CurrentUser() user: JwtPayload) {
    return this.adRevenue.getCreatorStats(user.sub);
  }

  /** Creator: opt a project into ad revenue. */
  @Post(':id/ad-revenue/enable')
  @HttpCode(HttpStatus.NO_CONTENT)
  async enableAdRevenue(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    await this.adRevenue.enableAdRevenue(user.sub, id);
  }

  /** Creator: opt a project out of ad revenue. */
  @Post(':id/ad-revenue/disable')
  @HttpCode(HttpStatus.NO_CONTENT)
  async disableAdRevenue(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    await this.adRevenue.disableAdRevenue(user.sub, id);
  }

  /** Admin: platform-wide ad revenue summary. */
  @Get('ad-revenue/platform-stats')
  getPlatformAdRevenueStats(@CurrentUser() user: JwtPayload) {
    if (!roleHasPermission(user.role as never, 'admin:revenue')) {
      throw new ForbiddenException('Requires admin:revenue permission');
    }
    return this.adRevenue.getPlatformStats();
  }

  /** Admin: manually trigger credit distribution (for testing / month-end reconciliation). */
  @Post('ad-revenue/distribute')
  @HttpCode(HttpStatus.OK)
  async triggerDistribution(@CurrentUser() user: JwtPayload) {
    if (!roleHasPermission(user.role as never, 'admin:revenue')) {
      throw new ForbiddenException('Requires admin:revenue permission');
    }
    return this.adRevenue.distributeAdRevenue();
  }

  @Post()
  create(@Body() dto: CreateProjectDto, @CurrentUser() user: JwtPayload) {
    return this.svc.create(user.sub, dto);
  }

  @Get()
  list(
    @CurrentUser() user: JwtPayload,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.list(user.sub, { cursor, limit: limit ? parseInt(limit, 10) : undefined });
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.svc.get(user.sub, id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateProjectDto>, @CurrentUser() user: JwtPayload) {
    return this.svc.update(user.sub, id, dto, user.role);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.svc.delete(user.sub, id, user.role);
  }
}
