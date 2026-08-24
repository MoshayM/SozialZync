import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

function getEncKey(): Buffer {
  const raw = process.env['PROVIDER_KEY_SECRET'];
  if (!raw && process.env['NODE_ENV'] === 'production') {
    throw new Error('PROVIDER_KEY_SECRET must be set in production — refusing to use insecure fallback');
  }
  return createHash('sha256').update(raw ?? 'dev-secret-32bytes-exactly-here!!').digest();
}

function encrypt(plain: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', getEncKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + enc.toString('hex');
}

function decrypt(cipher: string): string {
  const [ivHex, encHex] = cipher.split(':');
  if (!ivHex || !encHex) return '';
  const iv = Buffer.from(ivHex, 'hex');
  const enc = Buffer.from(encHex, 'hex');
  const decipher = createDecipheriv('aes-256-cbc', getEncKey(), iv);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

export interface ProviderConfigDto {
  provider: string;
  label: string;
  baseUrl: string;
  apiKey?: string | null;
  model?: string | null;
  enabled?: boolean;
  priority?: number;
  isDefault?: boolean;
  isFallback?: boolean;
  temperature?: number | null;
  maxTokens?: number | null;
  streaming?: boolean;
  visionSupport?: boolean;
  functionCalling?: boolean;
  contextLength?: number | null;
  reasoningMode?: boolean;
}

@Injectable()
export class ProviderConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const rows = await this.prisma.userProviderConfig.findMany({
      where: { userId },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });
    return rows.map(r => ({ ...r, apiKey: r.apiKeyEnc ? '••••••••' : null, apiKeyEnc: undefined }));
  }

  async upsert(userId: string, dto: ProviderConfigDto) {
    const existing = await this.prisma.userProviderConfig.findFirst({
      where: { userId, provider: dto.provider },
    });
    const data = {
      label: dto.label,
      baseUrl: dto.baseUrl,
      apiKeyEnc: dto.apiKey ? encrypt(dto.apiKey) : (existing?.apiKeyEnc ?? null),
      model: dto.model ?? null,
      enabled: dto.enabled ?? true,
      priority: dto.priority ?? 50,
      isDefault: dto.isDefault ?? false,
      isFallback: dto.isFallback ?? false,
      temperature: dto.temperature ?? null,
      maxTokens: dto.maxTokens ?? null,
      streaming: dto.streaming ?? true,
      visionSupport: dto.visionSupport ?? false,
      functionCalling: dto.functionCalling ?? false,
      contextLength: dto.contextLength ?? null,
      reasoningMode: dto.reasoningMode ?? false,
    };
    if (existing) {
      return this.prisma.userProviderConfig.update({ where: { id: existing.id }, data });
    }
    return this.prisma.userProviderConfig.create({ data: { ...data, userId, provider: dto.provider } });
  }

  async remove(userId: string, provider: string) {
    await this.prisma.userProviderConfig.deleteMany({ where: { userId, provider } });
  }

  async getDecrypted(userId: string, provider: string) {
    const row = await this.prisma.userProviderConfig.findFirst({ where: { userId, provider } });
    if (!row) return null;
    return { ...row, apiKey: row.apiKeyEnc ? decrypt(row.apiKeyEnc) : null };
  }

  async testConnection(userId: string, provider: string): Promise<{ ok: boolean; message: string; models?: string[] }> {
    const cfg = await this.getDecrypted(userId, provider);
    if (!cfg) return { ok: false, message: 'Provider not configured' };

    try {
      const url = cfg.baseUrl.replace(/\/$/, '');

      if (provider === 'ollama') {
        const r = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(5000) });
        if (!r.ok) return { ok: false, message: `Ollama returned ${r.status}` };
        const data = await r.json() as { models?: Array<{ name: string }> };
        const models = (data.models ?? []).map((m) => m.name);
        return { ok: true, message: `Connected — ${models.length} model(s)`, models };
      }

      // Anthropic uses x-api-key header and its own models endpoint
      if (provider === 'anthropic') {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          ...(cfg.apiKey ? { 'x-api-key': cfg.apiKey } : {}),
        };
        const r = await fetch('https://api.anthropic.com/v1/models', { headers, signal: AbortSignal.timeout(5000) });
        if (!r.ok) return { ok: false, message: `Anthropic returned ${r.status}` };
        const data = await r.json() as { data?: Array<{ id: string }> };
        const models = (data.data ?? []).map((m) => m.id).slice(0, 20);
        return { ok: true, message: `Connected — ${models.length} model(s)`, models };
      }

      // Gemini uses key param, not Bearer token
      if (provider === 'gemini') {
        const apiKey = cfg.apiKey ?? '';
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`, { signal: AbortSignal.timeout(5000) });
        if (!r.ok) return { ok: false, message: `Gemini returned ${r.status}` };
        const data = await r.json() as { models?: Array<{ name: string }> };
        const models = (data.models ?? []).map((m) => m.name.replace('models/', '')).slice(0, 20);
        return { ok: true, message: `Connected — ${models.length} model(s)`, models };
      }

      // OpenAI-compatible (OpenAI, Groq, Mistral, DeepSeek, etc.): GET /models with Bearer token
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (cfg.apiKey) headers['Authorization'] = `Bearer ${cfg.apiKey}`;
      const r = await fetch(`${url}/models`, { headers, signal: AbortSignal.timeout(5000) });
      if (!r.ok) return { ok: false, message: `Endpoint returned ${r.status}` };
      const data = await r.json() as { data?: Array<{ id: string }> };
      const models = (data.data ?? []).map((m) => m.id).slice(0, 20);
      return { ok: true, message: `Connected — ${models.length} model(s)`, models };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : 'Connection failed' };
    }
  }

  async listOllamaModels(userId: string): Promise<{ name: string; size: number; modified: string }[]> {
    const cfg = await this.getDecrypted(userId, 'ollama');
    if (!cfg?.enabled) return [];
    try {
      const r = await fetch(`${cfg.baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
      if (!r.ok) return [];
      const data = await r.json() as { models?: Array<{ name: string; size: number; modified_at: string }> };
      return (data.models ?? []).map(m => ({ name: m.name, size: m.size, modified: m.modified_at }));
    } catch { return []; }
  }

  async pullOllamaModel(userId: string, model: string): Promise<{ ok: boolean; message: string }> {
    const cfg = await this.getDecrypted(userId, 'ollama');
    if (!cfg?.enabled) return { ok: false, message: 'Ollama not configured' };
    try {
      const r = await fetch(`${cfg.baseUrl}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: model, stream: false }),
        signal: AbortSignal.timeout(300_000),
      });
      return r.ok ? { ok: true, message: `${model} pulled successfully` } : { ok: false, message: `Pull failed: ${r.status}` };
    } catch (e) { return { ok: false, message: e instanceof Error ? e.message : 'Pull failed' }; }
  }

  async deleteOllamaModel(userId: string, model: string): Promise<{ ok: boolean; message: string }> {
    const cfg = await this.getDecrypted(userId, 'ollama');
    if (!cfg?.enabled) return { ok: false, message: 'Ollama not configured' };
    try {
      const r = await fetch(`${cfg.baseUrl}/api/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: model }),
        signal: AbortSignal.timeout(15_000),
      });
      return r.ok ? { ok: true, message: `${model} deleted` } : { ok: false, message: `Delete failed: ${r.status}` };
    } catch (e) { return { ok: false, message: e instanceof Error ? e.message : 'Delete failed' }; }
  }
}
