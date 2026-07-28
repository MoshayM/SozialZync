import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SystemService } from './system.service';

@Controller('system')
@UseGuards(JwtAuthGuard)
export class SystemController {
  constructor(private readonly svc: SystemService) {}

  @Get('stats')
  async getStats(@Query('refresh') refresh?: string) {
    return this.svc.getStats(refresh === 'true');
  }

  @Get('gpu')
  async getGpu() {
    const stats = await this.svc.getStats();
    return { gpus: stats.gpus, primaryBackend: stats.primaryBackend };
  }

  @Get('disk')
  async getDisk(@Query('path') path = process.cwd()) {
    return this.svc.getDiskUsage(path);
  }
}
