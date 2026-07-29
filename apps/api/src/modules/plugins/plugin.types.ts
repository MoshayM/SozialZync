export type PluginHook =
  | 'before:generate'
  | 'after:generate'
  | 'before:publish'
  | 'after:publish'
  | 'on:error';

export interface PluginContext {
  userId: string;
  projectId?: string;
  data: Record<string, unknown>;
}

export interface IPlugin {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly hooks: PluginHook[];
  execute(hook: PluginHook, ctx: PluginContext): Promise<PluginContext>;
}
