import { Body, Controller, Get, Post, UseGuards, ForbiddenException } from '@nestjs/common';
import { IsString } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';
import { roleHasPermission } from '../../common/rbac';

interface ProviderStatus {
  name: string;
  envKey: string;
  configured: boolean;
  status: 'active' | 'unconfigured';
  category: 'ai' | 'media' | 'email' | 'payment';
  note?: string;
}

const SYSTEM_PROVIDERS: Array<Omit<ProviderStatus, 'configured' | 'status' | 'note'>> = [
  { name: 'Anthropic (Claude)', envKey: 'ANTHROPIC_API_KEY', category: 'ai' },
  { name: 'OpenAI (GPT-4)', envKey: 'OPENAI_API_KEY', category: 'ai' },
  { name: 'Google Gemini', envKey: 'GEMINI_API_KEY', category: 'ai' },
  { name: 'Groq', envKey: 'GROQ_API_KEY', category: 'ai' },
  { name: 'Google OAuth', envKey: 'GOOGLE_CLIENT_ID', category: 'ai' },
  { name: 'ElevenLabs (Voice)', envKey: 'ELEVENLABS_API_KEY', category: 'media' },
  { name: 'PiAPI (Kling / Suno / Udio)', envKey: 'PIAPI_API_KEY', category: 'media' },
  { name: 'Runway ML', envKey: 'RUNWAYML_API_SECRET', category: 'media' },
  { name: 'Replicate', envKey: 'REPLICATE_API_TOKEN', category: 'media' },
  { name: 'Stability AI', envKey: 'STABILITY_API_KEY', category: 'media' },
  { name: 'Pexels (Stock)', envKey: 'PEXELS_API_KEY', category: 'media' },
  { name: 'Pixabay (Stock)', envKey: 'PIXABAY_API_KEY', category: 'media' },
  { name: 'YouTube Data API', envKey: 'YOUTUBE_API_KEY', category: 'media' },
  { name: 'Facebook / Meta App', envKey: 'FACEBOOK_APP_ID', category: 'media' },
  { name: 'Resend (Email)', envKey: 'RESEND_API_KEY', category: 'email' },
  { name: 'Stripe (Payments)', envKey: 'STRIPE_SECRET_KEY', category: 'payment' },
];

// Placeholder keys set during dev — flagged as unconfigured in production health check
const PLACEHOLDER_VALS = new Set(['sk_test_cflocalstripe', 'pk_test_cflocalstripe', 'whsec_cf_local_test_secret']);

class TestProviderDto {
  @IsString() envKey!: string;
}

async function liveTest(envKey: string): Promise<{ ok: boolean; message: string }> {
  const key = process.env[envKey] ?? '';
  if (!key || PLACEHOLDER_VALS.has(key)) {
    return { ok: false, message: 'Key not configured' };
  }

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

@Controller('admin/providers')
@UseGuards(JwtAuthGuard)
export class ProviderHealthController {
  @Get('health')
  getProviderHealth(@CurrentUser() user: JwtPayload): ProviderStatus[] {
    if (!roleHasPermission(user.role as never, 'admin:providers')) {
      throw new ForbiddenException('Requires admin:providers permission');
    }

    return SYSTEM_PROVIDERS.map((p) => {
      const val = process.env[p.envKey] ?? '';
      const hasValue = val.length > 0;
      const isPlaceholder = PLACEHOLDER_VALS.has(val);
      const configured = hasValue && !isPlaceholder;
      return {
        ...p,
        configured,
        status: configured ? 'active' : 'unconfigured',
        ...(isPlaceholder ? { note: 'Placeholder value — replace with a real key' } : {}),
      } satisfies ProviderStatus;
    });
  }

  @Post('test')
  async testProvider(
    @CurrentUser() user: JwtPayload,
    @Body() dto: TestProviderDto,
  ): Promise<{ ok: boolean; message: string }> {
    if (!roleHasPermission(user.role as never, 'admin:providers')) {
      throw new ForbiddenException('Requires admin:providers permission');
    }
    return liveTest(dto.envKey);
  }
}
