import { Controller, Get, UseGuards, ForbiddenException } from '@nestjs/common';
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
}
