import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';
import { ProviderConfigService, type ProviderConfigDto } from './provider-config.service';

@Controller('provider-configs')
@UseGuards(JwtAuthGuard)
export class ProviderConfigController {
  constructor(private readonly svc: ProviderConfigService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.svc.list(user.sub);
  }

  @Post()
  upsert(@CurrentUser() user: JwtPayload, @Body() dto: ProviderConfigDto) {
    return this.svc.upsert(user.sub, dto);
  }

  @Delete(':provider')
  remove(@CurrentUser() user: JwtPayload, @Param('provider') provider: string) {
    return this.svc.remove(user.sub, provider);
  }

  @Post(':provider/test')
  testConnection(@CurrentUser() user: JwtPayload, @Param('provider') provider: string) {
    return this.svc.testConnection(user.sub, provider);
  }

  @Get('ollama/models')
  ollamaModels(@CurrentUser() user: JwtPayload) {
    return this.svc.listOllamaModels(user.sub);
  }

  @Post('ollama/pull')
  ollamaPull(@CurrentUser() user: JwtPayload, @Body() body: { model: string }) {
    return this.svc.pullOllamaModel(user.sub, body.model);
  }

  @Delete('ollama/models/:model')
  ollamaDelete(@CurrentUser() user: JwtPayload, @Param('model') model: string) {
    return this.svc.deleteOllamaModel(user.sub, model);
  }
}
