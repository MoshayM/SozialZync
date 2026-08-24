import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export type GuardrailViolationType =
  | 'INJECTION'       // prompt injection / jailbreak attempt
  | 'ABUSE'           // hate speech, threats, explicit/harmful content
  | 'PII_EXPOSED'     // user accidentally shared credentials/PII (redacted, allowed through)
  | 'TOPIC_VIOLATION' // clear off-scope harmful request
  | 'OUTPUT_LEAK';    // LLM output contained credentials or system context

export interface GuardrailResult {
  /** Whether the message should proceed to the LLM. */
  allowed: boolean;
  /** Reason for blocking (undefined when allowed). */
  violation?: GuardrailViolationType;
  /** Safe reply to return to the user when blocked — never exposes the rule details. */
  userMessage?: string;
  /** The (PII-redacted) text to use for LLM input and DB writes. */
  sanitizedText: string;
  /** True when at least one PII pattern was redacted. */
  piiRedacted: boolean;
}

// ── PII patterns ──────────────────────────────────────────────────────────────
// Each entry: [pattern, replacement]. Replacement may use $1 for capture groups.
const PII_PATTERNS: ReadonlyArray<[RegExp, string]> = [
  // Payment card numbers (13-19 digits, optional separators)
  [/\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{1,4}\b/g, '[CARD-REDACTED]'],
  // US Social Security Numbers
  [/\b\d{3}[\s\-]\d{2}[\s\-]\d{4}\b/g, '[SSN-REDACTED]'],
  // PEM private keys
  [/-----BEGIN\s+(RSA\s+|EC\s+)?PRIVATE KEY-----[\s\S]*?-----END\s+(RSA\s+|EC\s+)?PRIVATE KEY-----/g, '[PRIVATE-KEY-REDACTED]'],
  // JWT tokens (three base64url segments)
  [/eyJ[a-zA-Z0-9_\-]{10,}\.eyJ[a-zA-Z0-9_\-]{10,}\.[a-zA-Z0-9_\-]{10,}/g, '[JWT-REDACTED]'],
  // Known provider key formats: Anthropic sk-ant-, OpenAI sk-, GitHub ghp_,
  // Stripe sk_live_/pk_live_/rk_live_, platform keys cfk_
  [/\b(sk-ant-[a-zA-Z0-9\-]{20,}|sk-[a-zA-Z0-9]{20,}|AIza[a-zA-Z0-9_\-]{35}|ghp_[a-zA-Z0-9]{36}|sk_live_[a-zA-Z0-9]{24,}|pk_live_[a-zA-Z0-9]{24,}|rk_live_[a-zA-Z0-9]{24,}|cfk_[a-zA-Z0-9]{16,})\b/g, '[API-KEY-REDACTED]'],
  // "password: value", "token = value", etc.
  [/\b(password|passwd|pwd|secret|token|api[_\-]?key)\s*[:=]\s*\S+/gi, '$1:[REDACTED]'],
];

// ── Prompt injection / jailbreak patterns ────────────────────────────────────
const INJECTION_PATTERNS: ReadonlyArray<RegExp> = [
  /ignore\s+(previous|all|your|these)\s+(instructions|rules|guidelines|constraints|prompt)/i,
  /forget\s+(everything|your|all)\s+(you\s+know|instructions|rules|training|context)/i,
  /pretend\s+(you\s+are|to\s+be|you're|that\s+you\s+are)/i,
  /act\s+as\s+(if\s+you\s+(are|were)|a\s+|an\s+)/i,
  /\bdan\s+mode\b/i,
  /\bjailbreak\b/i,
  /developer\s+mode\s+(enabled|on|activated)/i,
  /bypass\s+(your|all|these|the)\s+(restrictions|rules|guidelines|safety|filters)/i,
  /you\s+are\s+now\s+(a\s+|an\s+)/i,
  /override\s+(your|all|these|the)\s+(instructions|system|rules|guidelines)/i,
  /disregard\s+(your|all|previous|these)\s+(instructions|rules|guidelines)?/i,
  /you\s+have\s+no\s+(restrictions|rules|guidelines|limits|safety)/i,
  /\[system\]|\<\|system\|\>|##\s*system/i,
  /new\s+instructions\s*:/i,
  /your\s+real\s+(instructions|purpose|role|goal)/i,
  /your\s+actual\s+(role|purpose|instructions|goal|function)/i,
  /reveal\s+(your\s+)?(system\s+prompt|prompt|instructions|training)/i,
  /(show|tell|print|display|repeat|output)\s+(me\s+)?(your\s+)?(system\s+prompt|prompt|instructions|constraints)/i,
];

// ── Abuse / harmful content patterns ─────────────────────────────────────────
const ABUSE_PATTERNS: ReadonlyArray<RegExp> = [
  /\b(i\s+will\s+(kill|murder|harm|attack|hurt|destroy)\s+(you|them|him|her))\b/i,
  /\b(you\s+(should|deserve\s+to)\s+(die|suffer|get\s+hurt))\b/i,
  /\bhow\s+to\s+(make|build|create|assemble|synthesize)\s+(a\s+)?(bomb|explosive|weapon|poison|toxin)/i,
  /\bhow\s+to\s+(commit\s+suicide|end\s+my\s+life|kill\s+myself|hurt\s+myself|self[\s\-]harm)/i,
  /\bchild\s+(sexual|explicit|nude|naked|pornograph)/i,
  /\b(csam|cp)\b(?!\s*(compliant|coverage|format))/i,
];

// ── Harmful off-topic patterns ────────────────────────────────────────────────
// Intentionally narrow: only block explicit harmful requests, not general curiosity.
// General off-topic is handled gracefully by the system prompt and the LLM's own alignment.
const TOPIC_VIOLATION_PATTERNS: ReadonlyArray<RegExp> = [
  /\bhow\s+to\s+launder\s+money\b/i,
  /\bhow\s+to\s+evade\s+(taxes|the\s+IRS|tax\s+authorities)\b/i,
  /\bhow\s+to\s+synthesize\s+(drugs|methamphetamine|heroin|fentanyl|cocaine)\b/i,
  /\bhow\s+to\s+(illegally\s+)?access\s+(classified|secret\s+government|classified\s+government)\s+(data|files|documents)\b/i,
];

// ── System-context leak markers in output ────────────────────────────────────
const SYSTEM_LEAK_MARKERS: ReadonlyArray<string> = [
  'COPILOT_SYSTEM',
  'contextSuffix',
  'pendingNote',
  'memoryBlock',
  'CONTEXT (current platform state',
  '[Auto-execute plan step',
  'Session memory]',
  'callAIStructured',
];

@Injectable()
export class CopilotGuardrailsService {
  private readonly logger = new Logger(CopilotGuardrailsService.name);

  // In-memory violation counter per user (resets on restart;
  // the persistent record lives in auditLog for cross-restart queries).
  private readonly violationCounts = new Map<string, number>();

  constructor(private readonly prisma: PrismaService) {}

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Screen user input BEFORE the LLM call.
   * Priority: PII redaction (always) → injection → abuse → topic violation.
   * PII is redacted and the message is still allowed through (user made a mistake);
   * the other three categories block the message entirely.
   */
  async screenInput(userId: string, text: string): Promise<GuardrailResult> {
    // Step 1: PII redaction — always, even if we block for another reason
    const { redacted, piiFound } = this.redactPii(text);
    if (piiFound) {
      await this.recordViolation(userId, 'PII_EXPOSED', text.slice(0, 200));
    }

    // Step 2: Prompt injection / jailbreak
    if (INJECTION_PATTERNS.some((p) => p.test(redacted))) {
      await this.recordViolation(userId, 'INJECTION', text.slice(0, 200));
      return {
        allowed: false,
        violation: 'INJECTION',
        userMessage:
          "I'm your Sozialzynk Copilot — I help with content creation and channel growth. Let's keep the focus there. What video project can I help you with today?",
        sanitizedText: redacted,
        piiRedacted: piiFound,
      };
    }

    // Step 3: Abuse / harmful content
    if (ABUSE_PATTERNS.some((p) => p.test(redacted))) {
      await this.recordViolation(userId, 'ABUSE', text.slice(0, 200));
      return {
        allowed: false,
        violation: 'ABUSE',
        userMessage:
          "I can't engage with that. I'm here to help you create great content and grow your channel. Ready to work on your next video?",
        sanitizedText: redacted,
        piiRedacted: piiFound,
      };
    }

    // Step 4: Clear harmful off-topic requests
    if (TOPIC_VIOLATION_PATTERNS.some((p) => p.test(redacted))) {
      await this.recordViolation(userId, 'TOPIC_VIOLATION', text.slice(0, 200));
      return {
        allowed: false,
        violation: 'TOPIC_VIOLATION',
        userMessage:
          "That's outside what I can help with. I specialise in YouTube content creation, channel strategy, and production pipelines. What can I help you create today?",
        sanitizedText: redacted,
        piiRedacted: piiFound,
      };
    }

    return { allowed: true, sanitizedText: redacted, piiRedacted: piiFound };
  }

  /**
   * Screen LLM output BEFORE returning it to the client.
   * Strips accidental credential leaks and system context exposure.
   */
  screenOutput(userId: string, text: string): { clean: string; flagged: boolean } {
    let clean = text;
    let flagged = false;

    // Redact any credentials that leaked through the model's output
    const { redacted, piiFound } = this.redactPii(text);
    if (piiFound) {
      clean = redacted;
      flagged = true;
      this.logger.warn(`[guardrails] Output PII redacted userId=${userId}`);
      void this.recordViolation(userId, 'OUTPUT_LEAK', text.slice(0, 200));
    }

    // Replace the reply if internal system context is leaking
    if (SYSTEM_LEAK_MARKERS.some((m) => clean.includes(m))) {
      clean = "I can help you with content creation and channel management. What would you like to work on next?";
      flagged = true;
      this.logger.warn(`[guardrails] Output system-context leak suppressed userId=${userId}`);
      void this.recordViolation(userId, 'OUTPUT_LEAK', text.slice(0, 200));
    }

    return { clean, flagged };
  }

  /**
   * Redact PII from any text — call before any DB write of user-submitted content.
   * Safe to call on output too.
   */
  redactPii(text: string): { redacted: string; piiFound: boolean } {
    let result = text;
    let piiFound = false;

    for (const [pattern, replacement] of PII_PATTERNS) {
      const before = result;
      result = result.replace(pattern, replacement);
      if (result !== before) piiFound = true;
    }

    return { redacted: result, piiFound };
  }

  /**
   * Write a violation event to the audit log and escalate when a user
   * accumulates 5 or more violations in the current process lifetime.
   */
  async recordViolation(userId: string, type: GuardrailViolationType, snippet: string): Promise<void> {
    const count = (this.violationCounts.get(userId) ?? 0) + 1;
    this.violationCounts.set(userId, count);
    const escalated = count >= 5;

    this.logger.warn(`[guardrails] violation userId=${userId} type=${type} count=${count}${escalated ? ' ESCALATED' : ''}`);

    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action: `guardrail:${type}`,
          meta: {
            type,
            snippet: snippet.slice(0, 200),
            violationCount: count,
            escalated,
          } as never,
        },
      });
    } catch (err) {
      // Audit write must never crash the chat — log and continue
      this.logger.error(`[guardrails] auditLog write failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (escalated) {
      this.logger.error(
        `[guardrails] ESCALATION: userId=${userId} has ${count} guardrail violations — review auditLog for guardrail:${type} events`,
      );
    }
  }

  /** Current in-process violation count for a user (for tests / health checks). */
  violationCount(userId: string): number {
    return this.violationCounts.get(userId) ?? 0;
  }
}
