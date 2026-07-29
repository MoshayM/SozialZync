import { Injectable, Logger } from '@nestjs/common';
import { IPlugin, PluginHook, PluginContext } from './plugin.types';

@Injectable()
export class PluginRegistryService {
  private readonly logger = new Logger(PluginRegistryService.name);
  private readonly plugins = new Map<string, IPlugin>();

  register(plugin: IPlugin): void {
    this.plugins.set(plugin.id, plugin);
    this.logger.log(`Plugin registered: ${plugin.name} v${plugin.version} (hooks: ${plugin.hooks.join(', ')})`);
  }

  unregister(pluginId: string): void {
    if (this.plugins.delete(pluginId)) {
      this.logger.log(`Plugin unregistered: ${pluginId}`);
    }
  }

  async executeHook(hook: PluginHook, ctx: PluginContext): Promise<PluginContext> {
    let current = ctx;
    for (const plugin of this.plugins.values()) {
      if (!plugin.hooks.includes(hook)) continue;
      try {
        current = await plugin.execute(hook, current);
      } catch (err) {
        this.logger.error(`Plugin '${plugin.id}' failed on hook '${hook}': ${String(err)}`);
      }
    }
    return current;
  }

  listPlugins(): Array<{ id: string; name: string; version: string; hooks: PluginHook[] }> {
    return Array.from(this.plugins.values()).map(p => ({
      id: p.id, name: p.name, version: p.version, hooks: p.hooks,
    }));
  }
}
