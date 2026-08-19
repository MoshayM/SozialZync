import type { IPlugin, PluginContext, PluginHook } from '../plugin.types';

export const SeoHygienePlugin: IPlugin = {
  id: 'builtin:seo-hygiene',
  name: 'SEO Hygiene',
  version: '1.0.0',
  hooks: ['before:publish'],
  async execute(hook: PluginHook, ctx: PluginContext): Promise<PluginContext> {
    if (hook !== 'before:publish') return ctx;
    const warnings: string[] = [];
    const title = ctx.data['title'] as string | undefined;
    const description = ctx.data['description'] as string | undefined;
    const tags = ctx.data['tags'] as string[] | undefined;
    if (title) {
      if (title.length < 30) warnings.push('Title is under 30 characters — longer titles tend to rank better.');
      if (title.length > 70) warnings.push('Title exceeds 70 characters and may be truncated in search results.');
      if (!/[A-Z]/.test(title[0] ?? '')) warnings.push('Title does not start with a capital letter.');
    }
    if (description) {
      if (description.length < 150) warnings.push('Description is under 150 characters — add more detail for better discoverability.');
      if (!description.includes('http') && !description.includes('www')) warnings.push('Description has no links — consider adding channel or social links.');
    }
    if (!tags || tags.length < 5) warnings.push('Fewer than 5 tags — add more tags to improve search coverage.');
    return { ...ctx, data: { ...ctx.data, seoWarnings: warnings } };
  },
};
