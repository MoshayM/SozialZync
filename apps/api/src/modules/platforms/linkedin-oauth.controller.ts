import { Controller, Get, Delete, Query, Res, UseGuards, Logger } from '@nestjs/common';
import { Response } from 'express';
import axios from 'axios';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TokenEncryptionService } from '../channels/token-encryption.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';

const LI_AUTH  = 'https://www.linkedin.com/oauth/v2/authorization';
const LI_TOKEN = 'https://www.linkedin.com/oauth/v2/accessToken';
const LI_ME    = 'https://api.linkedin.com/v2/userinfo';   // OpenID Connect endpoint

// openid + profile + email for identity; w_member_social for posting
const LI_SCOPES = 'openid profile email w_member_social offline_access';

@Controller('platforms/linkedin')
export class LinkedInOAuthController {
  private readonly logger = new Logger(LinkedInOAuthController.name);

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
    const redirectUri = `${apiBase}/platforms/linkedin/callback`;
    const state = Buffer.from(JSON.stringify({ userId, returnTo })).toString('base64url');

    const params = new URLSearchParams({
      client_id: process.env['LINKEDIN_CLIENT_ID'] ?? '',
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: LI_SCOPES,
      state,
    });
    res.redirect(`${LI_AUTH}?${params.toString()}`);
  }

  @Delete('disconnect')
  @UseGuards(JwtAuthGuard)
  async disconnect(@CurrentUser() user: JwtPayload) {
    await this.prisma.platformConnection.deleteMany({
      where: { userId: user.sub, platformId: 'linkedin' },
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
    const redirectUri = `${apiBase}/platforms/linkedin/callback`;

    if (error) {
      this.logger.warn(`LinkedIn OAuth denied: ${error}`);
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
        refresh_token?: string;
        expires_in: number;
        refresh_token_expires_in?: number;
        scope: string;
      }>(LI_TOKEN, new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: process.env['LINKEDIN_CLIENT_ID'] ?? '',
        client_secret: process.env['LINKEDIN_CLIENT_SECRET'] ?? '',
      }).toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }).catch(e => {
        const detail = (e as { response?: { data?: unknown } })?.response?.data;
        this.logger.error('LinkedIn token exchange failed', detail ?? String(e));
        throw new Error('token_exchange');
      });

      const { access_token, refresh_token, expires_in, refresh_token_expires_in } = tokenResp.data;

      // Fetch profile via OpenID Connect userinfo endpoint
      const profileResp = await axios.get<{
        sub: string;
        name?: string;
        given_name?: string;
        family_name?: string;
        picture?: string;
        email?: string;
      }>(LI_ME, {
        headers: { Authorization: `Bearer ${access_token}` },
      }).catch(e => {
        const detail = (e as { response?: { data?: unknown } })?.response?.data;
        this.logger.error('LinkedIn profile fetch failed', detail ?? String(e));
        throw new Error('profile_fetch');
      });

      const profile = profileResp.data;
      const fullName = `${profile.given_name ?? ''} ${profile.family_name ?? ''}`.trim();
      const displayName = profile.name ?? (fullName || 'LinkedIn User');
      const linkedInId = profile.sub;
      this.logger.log(`LinkedIn connected: ${displayName} (${linkedInId})`);

      const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();
      const refreshExpiresAt = refresh_token_expires_in
        ? new Date(Date.now() + refresh_token_expires_in * 1000).toISOString()
        : null;

      const encryptedTokens = this.enc.encrypt(
        JSON.stringify({ accessToken: access_token, refreshToken: refresh_token ?? null, linkedInId, expiresAt, refreshExpiresAt }),
      );

      await this.prisma.platformConnection.upsert({
        where: { userId_platformId: { userId, platformId: 'linkedin' } },
        create: { userId, platformId: 'linkedin', accountId: linkedInId, accountName: displayName, encryptedTokens, scopes: LI_SCOPES },
        update: { accountId: linkedInId, accountName: displayName, encryptedTokens, scopes: LI_SCOPES },
      });

      return res.redirect(`${webUrl}${returnTo}&connected=linkedin`);
    } catch (err) {
      const reason = (err as Error).message ?? 'unknown';
      this.logger.error(`LinkedIn OAuth failed at: ${reason}`);
      return res.redirect(`${webUrl}${returnTo}&error=linkedin_auth_failed`);
    }
  }

  // Refresh a LinkedIn access token using the stored refresh token
  @Get('refresh')
  @UseGuards(JwtAuthGuard)
  async refreshToken(@CurrentUser() user: JwtPayload, @Res() res: Response) {
    const conn = await this.prisma.platformConnection.findUnique({
      where: { userId_platformId: { userId: user.sub, platformId: 'linkedin' } },
    });
    if (!conn) return res.status(404).json({ error: 'LinkedIn not connected' });

    try {
      const stored = JSON.parse(this.enc.decrypt(conn.encryptedTokens)) as { refreshToken?: string };
      if (!stored.refreshToken) return res.status(400).json({ error: 'No refresh token stored' });

      const resp = await axios.post<{ access_token: string; expires_in: number; refresh_token?: string; refresh_token_expires_in?: number }>(
        LI_TOKEN,
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: stored.refreshToken,
          client_id: process.env['LINKEDIN_CLIENT_ID'] ?? '',
          client_secret: process.env['LINKEDIN_CLIENT_SECRET'] ?? '',
        }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );

      const { access_token, expires_in, refresh_token, refresh_token_expires_in } = resp.data;
      const existing = JSON.parse(this.enc.decrypt(conn.encryptedTokens)) as Record<string, unknown>;
      const updated = {
        ...existing,
        accessToken: access_token,
        refreshToken: refresh_token ?? stored.refreshToken,
        expiresAt: new Date(Date.now() + expires_in * 1000).toISOString(),
        ...(refresh_token_expires_in ? { refreshExpiresAt: new Date(Date.now() + refresh_token_expires_in * 1000).toISOString() } : {}),
      };
      await this.prisma.platformConnection.update({
        where: { userId_platformId: { userId: user.sub, platformId: 'linkedin' } },
        data: { encryptedTokens: this.enc.encrypt(JSON.stringify(updated)) },
      });
      return res.json({ ok: true });
    } catch (err) {
      this.logger.error('LinkedIn token refresh failed', err);
      return res.status(400).json({ error: 'refresh_failed' });
    }
  }
}
