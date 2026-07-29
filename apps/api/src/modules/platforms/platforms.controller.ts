import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';
import { PlatformRegistryService } from './platform-registry.service';

@Controller('platforms')
@UseGuards(JwtAuthGuard)
export class PlatformsController {
  constructor(private readonly registry: PlatformRegistryService) {}

  @Get()
  listPlatforms() {
    return this.registry.listProviders();
  }

  @Get('connection-status')
  async getConnectionStatuses(@CurrentUser() user: JwtPayload) {
    return this.registry.getAllConnectionStatuses(user.sub);
  }
}
