import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';
import { PushService, type PushSubscriptionDto } from './push.service';

// ── Request body types ────────────────────────────────────────────────────────

interface SubscribeBody {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface UnsubscribeBody {
  endpoint: string;
}

// ── Controller ────────────────────────────────────────────────────────────────

/**
 * Web Push subscription management.
 *
 * All mutating routes require a valid JWT. The public-key endpoint is
 * intentionally open so the frontend can fetch it before the user has
 * authenticated (needed to subscribe during the loading phase).
 */
@Controller('notifications/push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  /**
   * GET /notifications/push/vapid-public-key
   * No auth — the client needs this to call PushManager.subscribe().
   */
  @Get('vapid-public-key')
  getVapidPublicKey(): { publicKey: string } {
    return { publicKey: this.pushService.getPublicKey() };
  }

  /**
   * POST /notifications/push/subscribe
   * Registers (or refreshes) a push subscription for the authenticated user.
   */
  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async subscribe(
    @CurrentUser() user: JwtPayload,
    @Body() body: SubscribeBody,
  ): Promise<void> {
    const sub: PushSubscriptionDto = {
      endpoint: body.endpoint,
      keys: { p256dh: body.keys.p256dh, auth: body.keys.auth },
    };
    await this.pushService.saveSubscription(user.sub, sub);
  }

  /**
   * DELETE /notifications/push/unsubscribe
   * Removes a push subscription by endpoint.
   */
  @Delete('unsubscribe')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async unsubscribe(@Body() body: UnsubscribeBody): Promise<void> {
    await this.pushService.removeSubscription(body.endpoint);
  }
}
