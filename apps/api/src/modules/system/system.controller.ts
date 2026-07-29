import { Controller, Get, Delete, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SystemService } from './system.service';
import { StorageService } from './storage.service';

@Controller('system')
@UseGuards(JwtAuthGuard)
export class SystemController {
  constructor(
    private readonly svc: SystemService,
    private readonly storageSvc: StorageService,
  ) {}

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

  @Get('storage')
  async getStorageStats() {
    return this.storageSvc.getStats();
  }

  @Delete('storage/:category')
  async clearCategory(@Param('category') category: string) {
    const valid = ['images', 'videos', 'voices', 'music', 'cache'];
    if (!valid.includes(category)) {
      throw new Error(`Cannot clear category '${category}' — only [${valid.join(', ')}] allowed`);
    }
    return this.storageSvc.clearCategory(category);
  }
}
