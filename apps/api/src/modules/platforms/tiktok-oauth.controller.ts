import { Controller, Get, Delete, Query, Res, UseGuards, Logger } from '@nestjs/common';
import { Response } from 'express';
import axios from 'axios';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TokenEncryptionService } from '../channels/token-encryption.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';

const TT_AUTH   = 'https://www.tiktok.com/v2/auth/authorize/';
const TT_TOKEN  = 'https://open.tiktokapis.com/v2/oauth/token/';
const TT_USER   = 'https://open.tiktokapis.com/v2/user/info/';

// Scopes: user info + list/upload videos
const TT_SCOPES = 'user.info.basic,video.list,video.publish';

@Controller('platforms/tiktok')
export class TikTokOAuthController {
  private readonly logger = new Logger(TikTokOAuthController.name);

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
    const apiBase = process.env['API_BASE_URL'] ?? process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4007/api/v1';
    const redirectUri = `${apiBase}/platforms/tiktok/callback`;
    const state = Buffer.from(JSON.stringify({ userId, returnTo })).toString('base64url');

    const params = new URLSearchParams({
      client_key: process.env['TIKTOK_CLIENT_KEY'] ?? '',
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: TT_SCOPES,
      state,
    });
    res.redirect(`${TT_AUTH}?${params.toString()}`);
  }

  @Delete('disconnect')
  @UseGuards(JwtAuthGuard)
  async disconnect(@CurrentUser() user: JwtPayload) {
    await this.prisma.platformConnection.deleteMany({
      where: { userId: user.sub, platformId: 'tiktok' },
    });
    return { ok: true };
  }

  @Get('callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    const webUrl = process.env['WEB_URL'] ?? process.env['NEXT_PUBLIC_WEB_URL'] ?? 'http://localhost:3007';
    const apiBase = process.env['API_BASE_URL'] ?? process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4007/api/v1';
    const redirectUri = `${apiBase}/platforms/tiktok/callback`;

    if (error) {
      this.logger.warn(`TikTok OAuth denied: ${error}`);
      return res.redirect(`${webUrl}/settings/channels?tab=connections&error=access_denied`);
    }

    let userId = '';
    let returnTo = '/settings/channels?tab=connections';
    try {
      const parsed = JSON.parse(Buffer.from(state, 'base64url').toString()) as { userId: string; returnTo: string };
      userId = parsed.userId;
      returnTo = parsed.returnTo ?? returnTo;
    } catch {
      return res.redirect(`${webUrl}/settings/channels?tab=connections&error=invalid_state`);
    }

    try {
      // Exchange code for tokens
      const tokenResp = await axios.post<{
        access_token: string;
        refresh_token: string;
        open_id: string;
        expires_in: number;
        refresh_expires_in: number;
        scope: string;
      }>(TT_TOKEN, new URLSearchParams({
        client_key: process.env['TIKTOK_CLIENT_KEY'] ?? '',
        client_secret: process.env['TIKTOK_CLIENT_SECRET'] ?? '',
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }).toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }).catch(e => {
        const detail = (e as { response?: { data?: unknown } })?.response?.data;
        this.logger.error('TikTok token exchange failed', detail ?? String(e));
        throw new Error('token_exchange');
      });

      const { access_token, refresh_token, open_id, expires_in, refresh_expires_in } = tokenResp.data;

      // Fetch user display name
      const userResp = await axios.post<{
        data: { user: { open_id: string; display_name: string; avatar_url?: string } };
      }>(
        `${TT_USER}?fields=open_id,display_name,avatar_url`,
        null,
        { headers: { Authorization: `Bearer ${access_token}` } },
      ).catch(() => ({ data: { data: { user: { open_id, display_name: 'TikTok User', avatar_url: '' } } } }));

      const user = userResp.data.data.user;
      this.logger.log(`TikTok connected: ${user.display_name} (${open_id})`);

      const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();
      const refreshExpiresAt = new Date(Date.now() + refresh_expires_in * 1000).toISOString();
      const encryptedTokens = this.enc.encrypt(
        JSON.stringify({ accessToken: access_token, refreshToken: refresh_token, openId: open_id, expiresAt, refreshExpiresAt }),
      );

      await this.prisma.platformConnection.upsert({
        where: { userId_platformId: { userId, platformId: 'tiktok' } },
        create: { userId, platformId: 'tiktok', accountId: open_id, accountName: user.display_name, encryptedTokens, scopes: TT_SCOPES },
        update: { accountId: open_id, accountName: user.display_name, encryptedTokens, scopes: TT_SCOPES },
      });

      return res.redirect(`${webUrl}${returnTo}&connected=tiktok`);
    } catch (err) {
      const reason = (err as Error).message ?? 'unknown';
      this.logger.error(`TikTok OAuth failed at: ${reason}`);
      return res.redirect(`${webUrl}${returnTo}&error=tiktok_auth_failed`);
    }
  }

  // Refresh a TikTok access token using the stored refresh token
  @Get('refresh')
  @UseGuards(JwtAuthGuard)
  async refreshToken(@CurrentUser() user: JwtPayload, @Res() res: Response) {
    const conn = await this.prisma.platformConnection.findUnique({
      where: { userId_platformId: { userId: user.sub, platformId: 'tiktok' } },
    });
    if (!conn) return res.status(404).json({ error: 'TikTok not connected' });

    try {
      const stored = JSON.parse(this.enc.decrypt(conn.encryptedTokens)) as { refreshToken: string };
      const resp = await axios.post<{ access_token: string; refresh_token: string; expires_in: number; refresh_expires_in: number }>(
        'https://open.tiktokapis.com/v2/oauth/token/refresh/',
        new URLSearchParams({
          client_key: process.env['TIKTOK_CLIENT_KEY'] ?? '',
          grant_type: 'refresh_token',
          refresh_token: stored.refreshToken,
        }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );
      const { access_token, refresh_token, expires_in, refresh_expires_in } = resp.data;
      const existing = JSON.parse(this.enc.decrypt(conn.encryptedTokens)) as Record<string, unknown>;
      const updated = {
        ...existing,
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt: new Date(Date.now() + expires_in * 1000).toISOString(),
        refreshExpiresAt: new Date(Date.now() + refresh_expires_in * 1000).toISOString(),
      };
      await this.prisma.platformConnection.update({
        where: { userId_platformId: { userId: user.sub, platformId: 'tiktok' } },
        data: { encryptedTokens: this.enc.encrypt(JSON.stringify(updated)) },
      });
      return res.json({ ok: true });
    } catch (err) {
      this.logger.error('TikTok token refresh failed', err);
      return res.status(400).json({ error: 'refresh_failed' });
    }
  }
}
