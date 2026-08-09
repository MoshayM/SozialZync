import type { IPlugin, PluginContext, PluginHook } from '../plugin.types';

export const ErrorReporterPlugin: IPlugin = {
  id: 'builtin:error-reporter',
  name: 'Error Reporter',
  version: '1.0.0',
  hooks: ['on:error'],
  async execute(hook: PluginHook, ctx: PluginContext): Promise<PluginContext> {
    if (hook !== 'on:error') return ctx;
    const error = ctx.data['error'] as string | undefined;
    const stage = ctx.data['stage'] as string | undefined;
    const retrySuggestion = stage === 'RESEARCH'
      ? 'Retrying research with a more specific niche query may help.'
      : stage === 'RENDER'
      ? 'Check that ffmpeg is on PATH and the input file is not corrupted.'
      : 'Retrying the failed stage usually resolves transient provider errors.';
    return { ...ctx, data: { ...ctx.data, retrySuggestion, errorLogged: true, errorSummary: `[${stage ?? 'unknown'}] ${error ?? 'unknown error'}` } };
  },
};
