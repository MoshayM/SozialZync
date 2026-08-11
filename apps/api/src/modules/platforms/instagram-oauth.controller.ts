import { Controller, Get, Delete, Query, Res, UseGuards, Logger } from '@nestjs/common';
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

  @Get('auth')
  startOAuth(
    @Query('userId') userId: string,
    @Query('returnTo') returnTo: string,
    @Res() res: Response,
  ) {
    const apiBase = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4007/api/v1';
    const redirectUri = `${apiBase}/platforms/instagram/callback`;
    const state = Buffer.from(JSON.stringify({ userId, returnTo })).toString('base64');
    const params = new URLSearchParams({
      client_id: process.env['FACEBOOK_APP_ID'] ?? '',
      redirect_uri: redirectUri,
      scope: IG_SCOPES,
      response_type: 'code',
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
    const webUrl = process.env['NEXT_PUBLIC_WEB_URL'] ?? 'http://localhost:3007';
    const apiBase = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4007/api/v1';
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
      );
      const accessToken = longTokenResp.data.access_token;
      const expiresIn = longTokenResp.data.expires_in ?? 5_184_000; // 60-day default

      // Get Facebook Pages linked to an Instagram Business/Creator account
      const pagesResp = await axios.get<{
        data: Array<{ id: string; name: string; instagram_business_account?: { id: string } }>;
      }>(`${FB_GRAPH}/me/accounts`, {
        params: { fields: 'id,name,instagram_business_account', access_token: accessToken },
      });
      const page = pagesResp.data.data.find(p => p.instagram_business_account);
      if (!page?.instagram_business_account) {
        return res.redirect(`${webUrl}/settings/channels?error=no_instagram_business_account`);
      }

      const igUserId = page.instagram_business_account.id;

      // Resolve Instagram username
      const igResp = await axios.get<{ username: string }>(`${FB_GRAPH}/${igUserId}`, {
        params: { fields: 'username', access_token: accessToken },
      });
      const username = igResp.data.username ?? page.name;

      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
      const encryptedTokens = this.enc.encrypt(
        JSON.stringify({ accessToken, igUserId, pageId: page.id, expiresAt }),
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
      this.logger.error('Instagram OAuth callback failed', err);
      return res.redirect(`${webUrl}/settings/channels?error=instagram_auth_failed`);
    }
  }
}
