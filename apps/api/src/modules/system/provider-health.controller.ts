import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, UseGuards, ForbiddenException } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';
import { roleHasPermission } from '../../common/rbac';
import { SystemKeyService } from './system-key.service';

interface ProviderStatus {
  name: string;
  envKey: string;
  configured: boolean;
  /** Where the key comes from: 'db' = admin-saved, 'env' = Railway env var, 'none' = not set */
  source: 'db' | 'env' | 'none';
  status: 'active' | 'unconfigured';
  category: 'ai' | 'media' | 'email' | 'payment';
  note?: string;
}

const SYSTEM_PROVIDERS: Array<Omit<ProviderStatus, 'configured' | 'status' | 'source' | 'note'>> = [
  { name: 'Anthropic (Claude)',        envKey: 'ANTHROPIC_API_KEY',    category: 'ai' },
  { name: 'OpenAI (GPT-4)',            envKey: 'OPENAI_API_KEY',       category: 'ai' },
  { name: 'Google Gemini',             envKey: 'GEMINI_API_KEY',       category: 'ai' },
  { name: 'Groq',                      envKey: 'GROQ_API_KEY',         category: 'ai' },
  { name: 'Google OAuth',              envKey: 'GOOGLE_CLIENT_ID',     category: 'ai' },
  { name: 'ElevenLabs (Voice)',        envKey: 'ELEVENLABS_API_KEY',   category: 'media' },
  { name: 'PiAPI (Kling / Suno / Udio)', envKey: 'PIAPI_API_KEY',     category: 'media' },
  { name: 'Runway ML',                 envKey: 'RUNWAYML_API_SECRET',  category: 'media' },
  { name: 'Replicate',                 envKey: 'REPLICATE_API_TOKEN',  category: 'media' },
  { name: 'Stability AI',              envKey: 'STABILITY_API_KEY',    category: 'media' },
  { name: 'Pexels (Stock)',            envKey: 'PEXELS_API_KEY',       category: 'media' },
  { name: 'Pixabay (Stock)',           envKey: 'PIXABAY_API_KEY',      category: 'media' },
  { name: 'YouTube Data API',          envKey: 'YOUTUBE_API_KEY',      category: 'media' },
  { name: 'Facebook / Meta App',       envKey: 'FACEBOOK_APP_ID',      category: 'media' },
  { name: 'Resend (Email)',            envKey: 'RESEND_API_KEY',       category: 'email' },
  { name: 'Stripe (Payments)',         envKey: 'STRIPE_SECRET_KEY',    category: 'payment' },
];

async function liveTest(key: string, envKey: string): Promise<{ ok: boolean; message: string }> {
  if (!key) return { ok: false, message: 'Key not configured' };

  try {
    switch (envKey) {
      case 'ANTHROPIC_API_KEY': {
        const r = await fetch('https://api.anthropic.com/v1/models', {
          headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
          signal: AbortSignal.timeout(8000),
        });
        return r.ok ? { ok: true, message: 'Connected' } : { ok: false, message: `HTTP ${r.status}` };
      }
      case 'OPENAI_API_KEY': {
        const r = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${key}` },
          signal: AbortSignal.timeout(8000),
        });
        return r.ok ? { ok: true, message: 'Connected' } : { ok: false, message: `HTTP ${r.status}` };
      }
      case 'GEMINI_API_KEY': {
        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`,
          { signal: AbortSignal.timeout(8000) },
        );
        return r.ok ? { ok: true, message: 'Connected' } : { ok: false, message: `HTTP ${r.status}` };
      }
      case 'GROQ_API_KEY': {
        const r = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${key}` },
          signal: AbortSignal.timeout(8000),
        });
        return r.ok ? { ok: true, message: 'Connected' } : { ok: false, message: `HTTP ${r.status}` };
      }
      case 'ELEVENLABS_API_KEY': {
        const r = await fetch('https://api.elevenlabs.io/v1/user', {
          headers: { 'xi-api-key': key },
          signal: AbortSignal.timeout(8000),
        });
        return r.ok ? { ok: true, message: 'Connected' } : { ok: false, message: `HTTP ${r.status}` };
      }
      case 'REPLICATE_API_TOKEN': {
        const r = await fetch('https://api.replicate.com/v1/models', {
          headers: { Authorization: `Token ${key}` },
          signal: AbortSignal.timeout(8000),
        });
        return r.ok ? { ok: true, message: 'Connected' } : { ok: false, message: `HTTP ${r.status}` };
      }
      case 'STABILITY_API_KEY': {
        const r = await fetch('https://api.stability.ai/v1/user/account', {
          headers: { Authorization: `Bearer ${key}` },
          signal: AbortSignal.timeout(8000),
        });
        return r.ok ? { ok: true, message: 'Connected' } : { ok: false, message: `HTTP ${r.status}` };
      }
      case 'PEXELS_API_KEY': {
        const r = await fetch('https://api.pexels.com/v1/search?query=test&per_page=1', {
          headers: { Authorization: key },
          signal: AbortSignal.timeout(8000),
        });
        return r.ok ? { ok: true, message: 'Connected' } : { ok: false, message: `HTTP ${r.status}` };
      }
      case 'PIXABAY_API_KEY': {
        const r = await fetch(
          `https://pixabay.com/api/?key=${encodeURIComponent(key)}&q=test&per_page=3`,
          { signal: AbortSignal.timeout(8000) },
        );
        return r.ok ? { ok: true, message: 'Connected' } : { ok: false, message: `HTTP ${r.status}` };
      }
      case 'RESEND_API_KEY': {
        const r = await fetch('https://api.resend.com/domains', {
          headers: { Authorization: `Bearer ${key}` },
          signal: AbortSignal.timeout(8000),
        });
        return r.ok ? { ok: true, message: 'Connected' } : { ok: false, message: `HTTP ${r.status}` };
      }
      case 'STRIPE_SECRET_KEY': {
        const r = await fetch('https://api.stripe.com/v1/balance', {
          headers: { Authorization: `Bearer ${key}` },
          signal: AbortSignal.timeout(8000),
        });
        return r.ok ? { ok: true, message: 'Connected' } : { ok: false, message: `HTTP ${r.status}` };
      }
      case 'PIAPI_API_KEY':
      case 'RUNWAYML_API_SECRET':
      case 'GOOGLE_CLIENT_ID':
      case 'YOUTUBE_API_KEY':
      case 'FACEBOOK_APP_ID':
        return { ok: true, message: 'Key is set — live test not available for this provider' };
      default:
        return { ok: true, message: 'Key is set' };
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Connection failed' };
  }
}

class UpsertKeyDto {
  @IsString() envKey!: string;
  @IsString() @MinLength(1) value!: string;
}

class TestKeyDto {
  @IsString() envKey!: string;
}

@Controller('admin/providers')
@UseGuards(JwtAuthGuard)
export class ProviderHealthController {
  constructor(private readonly systemKey: SystemKeyService) {}

  private assertAdmin(user: JwtPayload): void {
    if (!roleHasPermission(user.role as never, 'admin:providers')) {
      throw new ForbiddenException('Requires admin:providers permission');
    }
  }

  @Get('health')
  async getProviderHealth(@CurrentUser() user: JwtPayload): Promise<ProviderStatus[]> {
    this.assertAdmin(user);

    const dbKeys = await this.systemKey.listStoredKeys();
    const dbSet = new Set(dbKeys);

    return SYSTEM_PROVIDERS.map((p) => {
      const envVal = process.env[p.envKey] ?? '';
      const inDb = dbSet.has(p.envKey);
      const inEnv = envVal.length > 0 && !this.systemKey.isPlaceholder(envVal);

      const configured = inDb || inEnv;
      const source: ProviderStatus['source'] = inDb ? 'db' : inEnv ? 'env' : 'none';

      const note = envVal.length > 0 && this.systemKey.isPlaceholder(envVal)
        ? 'Placeholder value — replace with a real key'
        : undefined;

      return {
        ...p,
        configured,
        status: configured ? 'active' : 'unconfigured',
        source,
        ...(note ? { note } : {}),
      } satisfies ProviderStatus;
    });
  }

  @Post('test')
  async testProvider(
    @CurrentUser() user: JwtPayload,
    @Body() dto: TestKeyDto,
  ): Promise<{ ok: boolean; message: string }> {
    this.assertAdmin(user);
    const key = await this.systemKey.resolve(dto.envKey);
    return liveTest(key, dto.envKey);
  }

  /** Upsert a provider key into the database (encrypted). */
  @Post('key')
  @HttpCode(HttpStatus.OK)
  async upsertKey(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpsertKeyDto,
  ): Promise<{ ok: boolean; message: string }> {
    this.assertAdmin(user);
    const valid = SYSTEM_PROVIDERS.some((p) => p.envKey === dto.envKey);
    if (!valid) throw new ForbiddenException(`Unknown provider key: ${dto.envKey}`);
    await this.systemKey.upsert(dto.envKey, dto.value.trim(), user.sub);
    return { ok: true, message: 'Key saved. Run "Test connection" to verify it works.' };
  }

  /** Remove the DB override — key falls back to Railway env var. */
  @Delete('key/:envKey')
  @HttpCode(HttpStatus.OK)
  async deleteKey(
    @CurrentUser() user: JwtPayload,
    @Param('envKey') envKey: string,
  ): Promise<{ ok: boolean; message: string }> {
    this.assertAdmin(user);
    await this.systemKey.delete(envKey);
    return { ok: true, message: 'DB override removed — key now reads from Railway env vars.' };
  }
}
