import { Controller, Get, Delete, Query, Res, UseGuards, Logger, HttpCode, Post, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { Response } from 'express';
import axios from 'axios';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TokenEncryptionService } from '../channels/token-encryption.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';

const FB_GRAPH = 'https://graph.facebook.com/v19.0';
const IG_SCOPES = 'instagram_basic,instagram_content_publish,pages_read_engagement,pages_show_list';

@Controller('platforms/instagram')
export class InstagramOAuthController {
  private readonly logger = new Logger(InstagramOAuthController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly enc: TokenEncryptionService,
  ) {}

  // ── Meta Webhook Verification (GET) ─────────────────────────────────────────
  // Meta sends hub.mode=subscribe + hub.verify_token + hub.challenge.
  // We echo back hub.challenge if the verify_token matches.
  @Get('webhook')
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const expected = process.env['META_WEBHOOK_VERIFY_TOKEN'] ?? '';
    if (mode === 'subscribe' && token === expected) {
      this.logger.log('Meta webhook verified');
      return (res as unknown as import('express').Response).status(200).send(challenge);
    }
    this.logger.warn('Meta webhook verification failed — token mismatch');
    return (res as unknown as import('express').Response).status(403).send('Forbidden');
  }

  // ── Meta Webhook Events (POST) ───────────────────────────────────────────────
  // Receives real-time notifications (e.g. Instagram comment, message, post status).
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
    this.logger.log('Meta webhook event received');
    // Future: process specific event types (instagram_business_account, etc.)
    return { received: true };
  }

  @Get('auth')
  startOAuth(
    @Query('userId') userId: string,
    @Query('returnTo') returnTo: string,
    @Res() res: Response,
  ) {
    const apiBase = process.env['API_BASE_URL'] ?? process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4007/api/v1';
    const redirectUri = `${apiBase}/platforms/instagram/callback`;
    const state = Buffer.from(JSON.stringify({ userId, returnTo })).toString('base64');
    const params = new URLSearchParams({
      client_id: process.env['FACEBOOK_APP_ID'] ?? '',
      redirect_uri: redirectUri,
      scope: IG_SCOPES,
      response_type: 'code',
      auth_type: 'rerequest',   // force FB to re-show permission checkboxes
      state,
    });
    res.redirect(`https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`);
  }

  @Delete('disconnect')
  @UseGuards(JwtAuthGuard)
  async disconnect(@CurrentUser() user: JwtPayload) {
    await this.prisma.platformConnection.deleteMany({
      where: { userId: user.sub, platformId: 'instagram' },
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
    const redirectUri = `${apiBase}/platforms/instagram/callback`;

    let userId = '';
    let returnTo = '/settings/channels';
    try {
      const parsed = JSON.parse(Buffer.from(state, 'base64').toString()) as { userId: string; returnTo: string };
      userId = parsed.userId;
      returnTo = parsed.returnTo ?? returnTo;
    } catch {
      return res.redirect(`${webUrl}/settings/channels?error=invalid_state`);
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
      }).catch((e) => {
        const detail = (e as any)?.response?.data?.error?.message ?? String(e);
        this.logger.error(`Instagram token exchange failed: ${detail}`);
        throw new Error('token_exchange');
      });
      const shortToken = tokenResp.data.access_token;

      // Exchange for long-lived token (~60 days)
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
      ).catch((e) => {
        const detail = (e as any)?.response?.data?.error?.message ?? String(e);
        this.logger.error(`Instagram long-lived token exchange failed: ${detail}`);
        throw new Error('token_exchange');
      });
      const accessToken = longTokenResp.data.access_token;
      const expiresIn = longTokenResp.data.expires_in ?? 5_184_000;

      // Log who we're authed as + what permissions were granted
      const [meResp, permResp] = await Promise.all([
        axios.get<{ id: string; name: string }>(`${FB_GRAPH}/me`, { params: { fields: 'id,name', access_token: accessToken } })
          .catch(() => ({ data: { id: 'unknown', name: 'unknown' } })),
        axios.get<{ data: Array<{ permission: string; status: string }> }>(`${FB_GRAPH}/me/permissions`, { params: { access_token: accessToken } })
          .catch(() => ({ data: { data: [] } })),
      ]);
      const granted = permResp.data.data.filter(p => p.status === 'granted').map(p => p.permission);
      this.logger.log(`Instagram authed as: ${meResp.data.name} (${meResp.data.id}), permissions: ${granted.join(', ')}`);

      // Get Facebook Pages this user manages + their linked Instagram Business accounts
      const pagesResp = await axios.get<{
        data: Array<{ id: string; name: string; access_token: string; instagram_business_account?: { id: string } }>;
      }>(`${FB_GRAPH}/me/accounts`, {
        params: { fields: 'id,name,access_token,instagram_business_account', access_token: accessToken },
      }).catch((e) => {
        const detail = (e as any)?.response?.data?.error?.message ?? String(e);
        this.logger.error(`Instagram pages lookup failed: ${detail}`);
        throw new Error('pages_lookup');
      });

      const allPages = pagesResp.data.data;
      const pagesWithIg = allPages.filter(p => p.instagram_business_account);
      this.logger.log(`Instagram pages found: ${allPages.length}, with IG business: ${pagesWithIg.length} — pages: ${allPages.map(p => p.name).join(', ')}`);

      let page = pagesWithIg[0] as { id: string; name: string; access_token: string; instagram_business_account?: { id: string } } | undefined;

      // Fallback: OAuth authed as Instagram-linked identity which has no Pages.
      // Use the already-stored Facebook page access token to find the IG Business account.
      if (allPages.length === 0) {
        this.logger.log('No pages via OAuth identity — trying stored Facebook page token as fallback');
        const fbConn = await this.prisma.platformConnection.findUnique({
          where: { userId_platformId: { userId, platformId: 'facebook' } },
        });
        if (!fbConn) {
          this.logger.warn('No Facebook connection found for fallback');
          return res.redirect(`${webUrl}${returnTo}?error=no_facebook_pages`);
        }
        let fbTokens: Record<string, string> = {};
        try { fbTokens = JSON.parse(this.enc.decrypt(fbConn.encryptedTokens)) as Record<string, string>; } catch { /* ignore */ }
        const fbPageToken = fbTokens['pageAccessToken'] ?? fbTokens['accessToken'];
        const fbPageId = fbConn.accountId;
        this.logger.log(`Fallback: checking Facebook page ${fbPageId} (${fbConn.accountName}) for Instagram Business account`);

        const fbPageResp = await axios.get<{ instagram_business_account?: { id: string }; name: string }>(
          `${FB_GRAPH}/${fbPageId}`,
          { params: { fields: 'instagram_business_account,name', access_token: fbPageToken } },
        ).catch((e) => {
          this.logger.error(`Fallback page lookup failed: ${(e as any)?.response?.data?.error?.message ?? String(e)}`);
          return null;
        });

        if (fbPageResp?.data?.instagram_business_account) {
          page = {
            id: fbPageId,
            name: fbConn.accountName ?? 'Facebook Page',
            access_token: fbPageToken,
            instagram_business_account: fbPageResp.data.instagram_business_account,
          };
          this.logger.log(`Fallback succeeded: found IG Business account ${page.instagram_business_account!.id}`);
        } else {
          this.logger.warn(`Fallback: Facebook page ${fbPageId} has no Instagram Business account linked`);
          return res.redirect(`${webUrl}${returnTo}?error=no_instagram_business_account`);
        }
      } else if (!page?.instagram_business_account) {
        return res.redirect(`${webUrl}${returnTo}?error=no_instagram_business_account`);
      }

      const igUserId = page!.instagram_business_account!.id;
      // Use page access token for IG API calls
      const pageToken = page!.access_token || accessToken;

      // Resolve Instagram username using page token
      const igResp = await axios.get<{ username: string; name: string }>(`${FB_GRAPH}/${igUserId}`, {
        params: { fields: 'username,name', access_token: pageToken },
      }).catch(() => ({ data: { username: page!.name, name: page!.name } }));
      const username = igResp.data.username ?? igResp.data.name ?? page!.name;
      this.logger.log(`Instagram connected: @${username} (igUserId=${igUserId})`);

      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
      // Store both user token and page token so media service can use the right one
      const encryptedTokens = this.enc.encrypt(
        JSON.stringify({ accessToken, pageToken, igUserId, pageId: page!.id, expiresAt }),
      );

      await this.prisma.platformConnection.upsert({
        where: { userId_platformId: { userId, platformId: 'instagram' } },
        create: {
          userId,
          platformId: 'instagram',
          accountId: igUserId,
          accountName: username,
          encryptedTokens,
          scopes: IG_SCOPES,
        },
        update: { accountId: igUserId, accountName: username, encryptedTokens, scopes: IG_SCOPES },
      });

      return res.redirect(`${webUrl}${returnTo}?connected=instagram`);
    } catch (err) {
      const reason = (err as Error).message ?? 'unknown';
      this.logger.error(`Instagram OAuth callback failed at step: ${reason}`);
      return res.redirect(`${webUrl}${returnTo}?error=instagram_auth_failed`);
    }
  }
}
