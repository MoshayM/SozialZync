import { Injectable, OnModuleInit } from '@nestjs/common';
import { PluginRegistryService } from './plugin-registry.service';
import { SeoHygienePlugin, DisclosureGuardPlugin, ErrorReporterPlugin } from './builtin';

@Injectable()
export class BuiltinPluginInitializer implements OnModuleInit {
  constructor(private readonly registry: PluginRegistryService) {}
  onModuleInit() {
    this.registry.register(SeoHygienePlugin);
    this.registry.register(DisclosureGuardPlugin);
    this.registry.register(ErrorReporterPlugin);
  }
}
