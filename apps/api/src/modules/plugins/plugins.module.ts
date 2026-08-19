import { Module } from '@nestjs/common';
import { PluginRegistryService } from './plugin-registry.service';
import { PluginsController } from './plugins.controller';
import { BuiltinPluginInitializer } from './builtin-plugin.initializer';

@Module({
  providers: [PluginRegistryService, BuiltinPluginInitializer],
  controllers: [PluginsController],
  exports: [PluginRegistryService],
})
export class PluginsModule {}
