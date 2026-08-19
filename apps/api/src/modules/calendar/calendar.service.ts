import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { callAIStructured } from '@cf/shared';
import { z } from 'zod';

const CalendarEntrySchema = z.object({
  title: z.string().min(1),
  category: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const CalendarResultSchema = z.object({
  entries: z.array(CalendarEntrySchema).min(1).max(28),
});

export type CalendarEntry = z.infer<typeof CalendarEntrySchema>;

const SYSTEM_PROMPT = `You are an expert YouTube content strategist. Generate a realistic, diverse content calendar.
Each entry must have a specific, clickable video title (not generic), an appropriate category, and a date spread evenly across the requested period.
Categories must be one of: Tutorial, Review, Trending, Educational, Entertainment, Behind the Scenes, Q&A, Challenge, Announcement, Other.
Respond only with valid JSON.`;

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);

  async generate(opts: { niche: string; channelName?: string; count: number; startDate: string }): Promise<CalendarEntry[]> {
    const { niche, channelName, count, startDate } = opts;

    if (!niche || niche.trim().length < 2) {
      throw new BadRequestException('Niche must be at least 2 characters');
    }
    const safeCount = Math.min(Math.max(count, 4), 28);

    const weeks = Math.ceil(safeCount / 2);
    const channelLabel = channelName ? ` for channel "${channelName}"` : '';

    this.logger.log(`Generating ${safeCount}-entry calendar — niche="${niche}" startDate=${startDate}`);

    try {
      const result = await callAIStructured(
        [{
          role: 'user',
          content: `Generate a ${safeCount}-video content calendar${channelLabel} for the niche: "${niche}".
Starting from ${startDate}, spread videos evenly across ${weeks} weeks (roughly 2 per week).
Each video needs a specific, engaging title that would perform well on YouTube — not generic placeholders.
Mix content types for variety. Return exactly ${safeCount} entries.`,
        }],
        CalendarResultSchema,
        {
          systemPrompt: SYSTEM_PROMPT,
          model: 'claude-haiku-4-5-20251001',
          maxTokens: 2048,
        },
      );
      return result.entries;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Calendar generation failed: ${msg}`);
      throw new BadRequestException(`Calendar generation failed: ${msg}`);
    }
  }
}
