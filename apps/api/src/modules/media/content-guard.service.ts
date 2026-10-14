import { Injectable, Logger } from '@nestjs/common';

export interface GuardResult {
  allowed: boolean;
  reason?: string;
  suggestedAlternative?: string;
  category?: 'violence' | 'adult' | 'hate' | 'spam' | 'misinformation' | 'copyright' | 'off-topic';
}

const HARD_BLOCK_PATTERNS = [
  /\b(porn|xxx|naked|nude|nsfw|hentai|erotic)\b/i,
  /\b(sexual\s+content|explicit\s+content)\b/i,
  /\b(child|minor|underage)\s+(sex|nude|porn|naked|explicit)/i,
  /\b(genocide|ethnic\s+cleansing|mass\s+murder)\b/i,
  /\b(cocaine|heroin|methamphetamine|fentanyl|drug\s+deal|buy\s+drugs)\b/i,
  /\b(suicide\s+method|how\s+to\s+kill\s+yourself|self.?harm\s+tutorial)\b/i,
  /\b(ddos\s+attack|phishing\s+kit|ransomware\s+code|malware\s+download)\b/i,
];

const SOFT_FLAG_PATTERNS = [
  /\b(graphic\s+violence|gore|torture)\b/i,
  /\b(scam|pyramid\s+scheme|get\s+rich\s+quick)\b/i,
  /\b(racial\s+slur|hate\s+speech)\b/i,
];

@Injectable()
export class ContentGuardService {
  private readonly logger = new Logger(ContentGuardService.name);

  check(text: string, context: 'script' | 'image' | 'video' | 'prompt'): GuardResult {
    if (!text?.trim()) return { allowed: true };

    for (const pattern of HARD_BLOCK_PATTERNS) {
      if (pattern.test(text)) {
        this.logger.warn(`Content blocked [${context}]: matched hard block pattern`);
        return {
          allowed: false,
          reason: 'This content contains prohibited material and cannot be processed.',
          category: this.detectCategory(text),
          suggestedAlternative: this.suggestAlternative(text, context),
        };
      }
    }

    const softFlagged = SOFT_FLAG_PATTERNS.some((p) => p.test(text));
    if (softFlagged) {
      this.logger.warn(`Content flagged [${context}]: soft flag (allowed with warning)`);
    }

    if ((context === 'prompt' || context === 'script') && text.trim().length < 3) {
      return {
        allowed: false,
        reason: 'The prompt is too short or unclear to generate meaningful content.',
        category: 'off-topic',
        suggestedAlternative: 'Please describe your video topic in more detail.',
      };
    }

    return { allowed: true };
  }

  private detectCategory(text: string): NonNullable<GuardResult['category']> {
    const t = text.toLowerCase();
    if (/porn|sex|adult|nude|erotic|hentai/.test(t)) return 'adult';
    if (/genocide|mass.?murder/.test(t)) return 'violence';
    if (/racial.?slur|hate.?speech/.test(t)) return 'hate';
    if (/scam|pyramid|fake/.test(t)) return 'misinformation';
    if (/cocaine|heroin|meth|fentanyl/.test(t)) return 'spam';
    if (/child|minor|underage/.test(t)) return 'adult';
    return 'off-topic';
  }

  private suggestAlternative(text: string, context: string): string {
    const cat = this.detectCategory(text);
    const map: Record<string, string> = {
      violence: 'Focus on the educational, historical, or dramatic aspects of your topic without graphic depictions.',
      adult: 'Create family-friendly content suitable for a YouTube audience. Focus on the informative or entertaining aspects of your topic.',
      hate: 'Create inclusive content that brings people together. Focus on shared interests and positive messages.',
      misinformation: 'Ensure your content is fact-based. Run the Fact Check stage to verify claims before publishing.',
      spam: 'Create original, valuable content around your expertise or niche that genuinely helps your audience.',
      copyright: 'Use original or properly licensed content. Cite sources and give credit where required.',
      'off-topic': context === 'image'
        ? 'Try a more descriptive scene: e.g. "A person working at a desk with soft natural lighting, cinematic"'
        : 'Try being more specific: e.g. "An educational video about [your topic] for beginners"',
    };
    return map[cat] ?? 'Rephrase your request to focus on educational, entertaining, or informative YouTube content.';
  }

  formatBlockMessage(result: GuardResult): string {
    const parts = [`⚠️ Content not allowed: ${result.reason}`];
    if (result.suggestedAlternative) {
      parts.push(`💡 Suggestion: ${result.suggestedAlternative}`);
    }
    return parts.join('\n\n');
  }
}
