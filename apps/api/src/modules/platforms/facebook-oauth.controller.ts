import { Controller, Get, Delete, Query, Res, UseGuards, Logger, HttpCode, Post, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { Response } from 'express';
import axios from 'axios';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TokenEncryptionService } from '../channels/token-encryption.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';

const FB_GRAPH = 'https://graph.facebook.com/v19.0';
const FB_SCOPES = 'pages_manage_posts,pages_read_engagement,pages_show_list,pages_manage_metadata';

@Controller('platforms/facebook')
export class FacebookOAuthController {
  private readonly logger = new Logger(FacebookOAuthController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly enc: TokenEncryptionService,
  ) {}

  // ── Meta Webhook Verification (GET) ─────────────────────────────────────────
  @Get('webhook')
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const expected = process.env['META_WEBHOOK_VERIFY_TOKEN'] ?? '';
    if (mode === 'subscribe' && token === expected) {
      this.logger.log('Meta Facebook webhook verified');
      return (res as unknown as import('express').Response).status(200).send(challenge);
    }
    this.logger.warn('Meta Facebook webhook verification failed — token mismatch');
    return (res as unknown as import('express').Response).status(403).send('Forbidden');
  }

  // ── Meta Webhook Events (POST) ───────────────────────────────────────────────
  @Post('webhook')
  @HttpCode(200)
  handleWebhookEvent(
    @Body() body: unknown,
    @Headers('x-hub-signature-256') signature: string,
  ) {
    const secret = process.env['FACEBOOK_APP_SECRET'] ?? '';
    if (signature && secret) {
      const expected = 'sha256=' + createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');
      if (signature !== expected) throw new UnauthorizedException('Invalid webhook signature');
    }
    this.logger.log('Meta Facebook webhook event received');
    return { received: true };
  }

  @Get('auth')
  startOAuth(
    @Query('userId') userId: string,
    @Query('returnTo') returnTo: string,
    @Res() res: Response,
  ) {
    const apiBase = process.env['API_BASE_URL'] ?? process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4007/api/v1';
    const redirectUri = `${apiBase}/platforms/facebook/callback`;
    const state = Buffer.from(JSON.stringify({ userId, returnTo })).toString('base64');
    const params = new URLSearchParams({
      client_id: process.env['FACEBOOK_APP_ID'] ?? '',
      redirect_uri: redirectUri,
      scope: FB_SCOPES,
      response_type: 'code',
      state,
    });
    res.redirect(`https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`);
  }

  @Delete('disconnect')
  @UseGuards(JwtAuthGuard)
  async disconnect(@CurrentUser() user: JwtPayload) {
    await this.prisma.platformConnection.deleteMany({
      where: { userId: user.sub, platformId: 'facebook' },
    });
    return { ok: true };
  }

  @Get('callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const webUrl = process.env['WEB_URL'] ?? process.env['NEXT_PUBLIC_WEB_URL'] ?? 'http://localhost:3007';
    const apiBase = process.env['API_BASE_URL'] ?? process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4007/api/v1';
    const redirectUri = `${apiBase}/platforms/facebook/callback`;

    let userId = '';
    let returnTo = '/publishing/accounts';
    try {
      const parsed = JSON.parse(Buffer.from(state, 'base64').toString()) as { userId: string; returnTo: string };
      userId = parsed.userId;
      returnTo = parsed.returnTo ?? returnTo;
    } catch {
      return res.redirect(`${webUrl}/publishing/accounts?error=invalid_state`);
    }

    try {
      // Exchange code for short-lived user token
      const tokenResp = await axios.get<{ access_token: string }>(`${FB_GRAPH}/oauth/access_token`, {
        params: {
          client_id: process.env['FACEBOOK_APP_ID'],
          client_secret: process.env['FACEBOOK_APP_SECRET'],
          redirect_uri: redirectUri,
          code,
        },
      });
      const shortToken = tokenResp.data.access_token;

      // Exchange for long-lived user token (~60 days)
      const longTokenResp = await axios.get<{ access_token: string; expires_in: number }>(
        `${FB_GRAPH}/oauth/access_token`,
        {
          params: {
            grant_type: 'fb_exchange_token',
            client_id: process.env['FACEBOOK_APP_ID'],
            client_secret: process.env['FACEBOOK_APP_SECRET'],
            fb_exchange_token: shortToken,
          },
        },
      );
      const userToken = longTokenResp.data.access_token;
      const expiresIn = longTokenResp.data.expires_in ?? 5_184_000;

      // Fetch the user's Facebook Pages
      const pagesResp = await axios.get<{
        data: Array<{ id: string; name: string; category?: string; fan_count?: number }>;
      }>(`${FB_GRAPH}/me/accounts`, {
        params: { fields: 'id,name,category,fan_count', access_token: userToken },
      });

      const pages = pagesResp.data.data;
      if (!pages.length) {
        return res.redirect(`${webUrl}/publishing/accounts?error=no_facebook_pages`);
      }

      // Pick the page with the most fans, or the first one
      const page = pages.reduce((best, p) =>
        (p.fan_count ?? 0) > (best.fan_count ?? 0) ? p : best,
      );

      // Get the permanent Page access token (never expires)
      const pageTokenResp = await axios.get<{ access_token: string }>(
        `${FB_GRAPH}/${page.id}`,
        { params: { fields: 'access_token', access_token: userToken } },
      );
      const pageAccessToken = pageTokenResp.data.access_token;

      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
      const encryptedTokens = this.enc.encrypt(
        JSON.stringify({ accessToken: userToken, pageId: page.id, pageAccessToken, expiresAt }),
      );

      await this.prisma.platformConnection.upsert({
        where: { userId_platformId: { userId, platformId: 'facebook' } },
        create: {
          userId,
          platformId: 'facebook',
          accountId: page.id,
          accountName: page.name,
          encryptedTokens,
          scopes: FB_SCOPES,
        },
        update: { accountId: page.id, accountName: page.name, encryptedTokens, scopes: FB_SCOPES },
      });

      return res.redirect(`${webUrl}${returnTo}?connected=facebook`);
    } catch (err) {
      this.logger.error('Facebook OAuth callback failed', err);
      return res.redirect(`${webUrl}/publishing/accounts?error=facebook_auth_failed`);
    }
  }
}
