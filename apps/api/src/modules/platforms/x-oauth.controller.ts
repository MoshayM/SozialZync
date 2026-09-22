import { Controller, Get, Delete, Query, Res, UseGuards, Logger } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { Response } from 'express';
import axios from 'axios';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TokenEncryptionService } from '../channels/token-encryption.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';

const X_AUTH     = 'https://twitter.com/i/oauth2/authorize';
const X_TOKEN    = 'https://api.twitter.com/2/oauth2/token';
const X_ME       = 'https://api.twitter.com/2/users/me';
const X_SCOPES   = 'tweet.read tweet.write users.read offline.access media.write';

interface StatePayload { userId: string; returnTo: string; cv: string; }

@Controller('platforms/x')
export class XOAuthController {
  private readonly logger = new Logger(XOAuthController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly enc: TokenEncryptionService,
  ) {}

  @Get('auth-url')
  @UseGuards(JwtAuthGuard)
  getAuthUrl(
    @CurrentUser() user: JwtPayload,
    @Query('returnTo') returnTo: string,
  ) {
    const apiBase = process.env['API_BASE_URL'] ?? process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4007/api/v1';
    const redirectUri = `${apiBase}/platforms/x/callback`;

    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

    const state = Buffer.from(
      JSON.stringify({ userId: user.sub, returnTo, cv: codeVerifier } satisfies StatePayload),
    ).toString('base64url');

    const params = new URLSearchParams({
      client_id: process.env['X_CLIENT_ID'] ?? '',
      redirect_uri: redirectUri,
      scope: X_SCOPES,
      response_type: 'code',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    return { url: `${X_AUTH}?${params.toString()}` };
  }

  @Delete('disconnect')
  @UseGuards(JwtAuthGuard)
  async disconnect(@CurrentUser() user: JwtPayload) {
    await this.prisma.platformConnection.deleteMany({
      where: { userId: user.sub, platformId: 'x' },
    });
    return { ok: true };
  }

  @Get('callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') oauthError: string,
    @Res() res: Response,
  ) {
    const webUrl = (process.env['WEB_URL'] ?? process.env['NEXT_PUBLIC_WEB_URL'] ?? 'http://localhost:3007').split(',')[0].trim();
    const apiBase = process.env['API_BASE_URL'] ?? process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4007/api/v1';
    const redirectUri = `${apiBase}/platforms/x/callback`;

    if (oauthError) {
      this.logger.warn(`X OAuth denied: ${oauthError}`);
      return res.redirect(`${webUrl}/publishing/accounts?error=access_denied`);
    }

    let payload: StatePayload;
    let returnTo = '/publishing/accounts';
    try {
      payload = JSON.parse(Buffer.from(state, 'base64url').toString()) as StatePayload;
      returnTo = payload.returnTo ?? returnTo;
    } catch {
      return res.redirect(`${webUrl}${returnTo}?error=invalid_state`);
    }

    const { userId, cv: codeVerifier } = payload;

    try {
      // Exchange code + code_verifier for tokens (confidential client uses Basic auth)
      const basicAuth = Buffer.from(
        `${process.env['X_CLIENT_ID'] ?? ''}:${process.env['X_CLIENT_SECRET'] ?? ''}`,
      ).toString('base64');

      const tokenResp = await axios.post<{
        access_token: string;
        refresh_token?: string;
        expires_in: number;
        scope: string;
      }>(X_TOKEN, new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
        client_id: process.env['X_CLIENT_ID'] ?? '',
      }).toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${basicAuth}`,
        },
      });

      const { access_token, refresh_token, expires_in } = tokenResp.data;

      // Fetch X profile
      const profileResp = await axios.get<{
        data: { id: string; name: string; username: string };
      }>(X_ME, {
        params: { 'user.fields': 'id,name,username' },
        headers: { Authorization: `Bearer ${access_token}` },
      });

      const { id: xId, name, username } = profileResp.data.data;
      const expiresAt = new Date(Date.now() + (expires_in ?? 7200) * 1000).toISOString();

      const encryptedTokens = this.enc.encrypt(
        JSON.stringify({ accessToken: access_token, refreshToken: refresh_token ?? null, xId, username, expiresAt }),
      );

      await this.prisma.platformConnection.upsert({
        where: { userId_platformId_accountId: { userId, platformId: 'x', accountId: xId } },
        create: { userId, platformId: 'x', accountId: xId, accountName: name, encryptedTokens, scopes: X_SCOPES },
        update: { accountId: xId, accountName: name, encryptedTokens, scopes: X_SCOPES },
      });

      this.logger.log(`X connected: @${username} (${xId})`);
      return res.redirect(`${webUrl}${returnTo}?connected=x`);
    } catch (err) {
      const detail = (err as { response?: { data?: unknown } })?.response?.data;
      this.logger.error('X OAuth callback failed', detail ?? String(err));
      return res.redirect(`${webUrl}${returnTo}?error=x_auth_failed`);
    }
  }
}
