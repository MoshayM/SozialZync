import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { z } from 'zod';

const GenerateBodySchema = z.object({
  niche: z.string().min(2).max(200),
  channelName: z.string().max(100).optional(),
  count: z.number().int().min(4).max(28).default(14),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

@Controller('calendar')
@UseGuards(JwtAuthGuard)
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Post('generate')
  async generate(@Body() body: unknown) {
    const parsed = GenerateBodySchema.safeParse(body);
    if (!parsed.success) {
      return { error: parsed.error.flatten().fieldErrors };
    }
    const entries = await this.calendar.generate(parsed.data);
    return { entries };
  }
}
