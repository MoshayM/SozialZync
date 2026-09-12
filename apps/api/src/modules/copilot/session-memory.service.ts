import { Injectable } from '@nestjs/common';
import { callAIStructured, type AIMessage } from '@cf/shared';
import { z } from 'zod';

const COMPRESS_AFTER = 8;

const SummarySchema = z.object({
  summary: z.string().max(800),
});

const store = new Map<string, { summary: string; turnCount: number }>();

@Injectable()
export class SessionMemoryService {
  getCompressed(userId: string): { summary: string; turnCount: number } | undefined {
    return store.get(userId);
  }

  shouldCompress(userId: string, messages: Array<{ role: string }>): boolean {
    const userTurns = messages.filter((m) => m.role === 'user').length;
    const existing = store.get(userId);
    const newTurns = userTurns - (existing?.turnCount ?? 0);
    return newTurns >= COMPRESS_AFTER;
  }

  async compressSession(userId: string, messages: Array<{ role: string; content: string }>): Promise<void> {
    const existing = store.get(userId);
    const contextNote = existing
      ? `Previous summary: ${existing.summary}\n\nNew messages since then:\n`
      : '';
    const msgText = messages
      .slice(-(COMPRESS_AFTER * 2))
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');

    const llmMessages: AIMessage[] = [
      { role: 'user', content: `${contextNote}${msgText}` },
    ];

    const result = await callAIStructured(llmMessages, SummarySchema, {
      model: 'claude-haiku-4-5-20251001',
      systemPrompt:
        'Compress this conversation into a compact memory block (under 800 chars). Preserve: (1) user goals and current workflow stage, (2) channels/projects mentioned with their IDs, (3) decisions already made (topic, audience, tone, content type, language), (4) the user\'s communication style (casual/formal, verbose/terse, technical level), (5) language preference (BCP-47 tag if non-English). These details allow the assistant to avoid asking the same questions twice and to maintain consistent tone. Reply with JSON only: {"summary":"..."}.',
      maxTokens: 300,
    });

    const userTurns = messages.filter((m) => m.role === 'user').length;
    store.set(userId, { summary: result.summary, turnCount: userTurns });
  }
}
