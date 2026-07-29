import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PluginRegistryService } from './plugin-registry.service';

@Controller('plugins')
@UseGuards(JwtAuthGuard)
export class PluginsController {
  constructor(private readonly registry: PluginRegistryService) {}

  @Get()
  listPlugins() {
    return this.registry.listPlugins();
  }
}
