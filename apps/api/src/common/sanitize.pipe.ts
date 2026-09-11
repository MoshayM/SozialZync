import { Injectable, PipeTransform } from '@nestjs/common';
import { sanitizeDeep } from './sanitize';

/**
 * Global sanitisation pipe — registered as APP_PIPE in AppModule so it runs
 * on every @Body(), @Query(), and @Param() argument BEFORE the ValidationPipe.
 *
 * Applies sanitizeDeep() to strip XSS injection patterns, null bytes, and
 * javascript: URIs from all string values recursively.  Non-string primitives
 * (numbers, booleans), Buffers, and Dates pass through unchanged.
 *
 * Order: SanitizePipe (APP_PIPE / module) → ValidationPipe (main.ts) → handler
 */
@Injectable()
export class SanitizePipe implements PipeTransform {
  transform(value: unknown): unknown {
    return sanitizeDeep(value);
  }
}
