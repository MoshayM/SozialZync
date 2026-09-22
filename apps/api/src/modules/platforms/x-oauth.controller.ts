import { Controller, Get, Delete, Query, Res, UseGuards, Logger } from '@nestjs/common';
import { createHmac, randomBytes } from 'crypto';
import { Response } from 'express';
import axios from 'axios';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TokenEncryptionService } from '../channels/token-encryption.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';

const X_REQUEST_TOKEN = 'https://api.twitter.com/oauth/request_token';
const X_AUTHORIZE     = 'https://api.twitter.com/oauth/authorize';
const X_ACCESS_TOKEN  = 'https://api.twitter.com/oauth/access_token';
const X_VERIFY_CREDS  = 'https://api.twitter.com/1.1/account/verify_credentials.json';

interface StatePayload { userId: string; returnTo: string; rts: string; }

function oauthSign(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret = '',
): string {
  const encode = (s: string) => encodeURIComponent(s);
  const sorted = Object.keys(params).sort()
    .map(k => `${encode(k)}=${encode(params[k])}`)
    .join('&');
  const base = `${method}&${encode(url)}&${encode(sorted)}`;
  const signingKey = `${encode(consumerSecret)}&${encode(tokenSecret)}`;
  return createHmac('sha1', signingKey).update(base).digest('base64');
}

function oauthHeader(
  method: string,
  url: string,
  extra: Record<string, string>,
  consumerKey: string,
  consumerSecret: string,
  token = '',
  tokenSecret = '',
): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: '1.0',
    ...extra,
  };
  if (token) oauthParams['oauth_token'] = token;

  oauthParams['oauth_signature'] = oauthSign(
    method, url, { ...oauthParams, ...extra }, consumerSecret, tokenSecret,
  );

  const encode = (s: string) => encodeURIComponent(s);
  return 'OAuth ' + Object.keys(oauthParams)
    .filter(k => k.startsWith('oauth_'))
    .sort()
    .map(k => `${encode(k)}="${encode(oauthParams[k]!)}"`)
    .join(', ');
}

@Controller('platforms/x')
export class XOAuthController {
  private readonly logger = new Logger(XOAuthController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly enc: TokenEncryptionService,
  ) {}

  @Get('auth-url')
  @UseGuards(JwtAuthGuard)
  async getAuthUrl(
    @CurrentUser() user: JwtPayload,
    @Query('returnTo') returnTo: string,
  ) {
    const apiBase = process.env['API_BASE_URL'] ?? process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4007/api/v1';
    const callbackUrl = `${apiBase}/platforms/x/callback`;
    const consumerKey    = process.env['X_API_KEY']    ?? '';
    const consumerSecret = process.env['X_API_SECRET'] ?? '';

    // Step 1: Get request token
    const authHeader = oauthHeader(
      'POST', X_REQUEST_TOKEN,
      { oauth_callback: callbackUrl },
      consumerKey, consumerSecret,
    );

    const reqTokenResp = await axios.post<string>(X_REQUEST_TOKEN, null, {
      headers: { Authorization: authHeader },
      responseType: 'text',
    });

    const reqParams = new URLSearchParams(reqTokenResp.data);
    const oauthToken = reqParams.get('oauth_token') ?? '';
    const oauthTokenSecret = reqParams.get('oauth_token_secret') ?? '';

    // Encode state: userId + returnTo + request token secret (needed at callback)
    const state = Buffer.from(
      JSON.stringify({ userId: user.sub, returnTo, rts: oauthTokenSecret } satisfies StatePayload),
    ).toString('base64url');

    // Attach state via oauth_token (Twitter echoes it via oauth_token in callback)
    // Store state mapping server-side keyed by oauth_token
    await this.prisma.platformConnection.upsert({
      where: { userId_platformId_accountId: { userId: user.sub, platformId: 'x', accountId: `pending_${oauthToken}` } },
      create: {
        userId: user.sub,
        platformId: 'x',
        accountId: `pending_${oauthToken}`,
        accountName: 'pending',
        encryptedTokens: this.enc.encrypt(state),
        scopes: 'pending',
        readOnly: true,
      },
      update: { encryptedTokens: this.enc.encrypt(state) },
    });

    return { url: `${X_AUTHORIZE}?oauth_token=${oauthToken}` };
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
    @Query('oauth_token') oauthToken: string,
    @Query('oauth_verifier') oauthVerifier: string,
    @Query('denied') denied: string,
    @Res() res: Response,
  ) {
    const webUrl = (process.env['WEB_URL'] ?? process.env['NEXT_PUBLIC_WEB_URL'] ?? 'http://localhost:3007').split(',')[0].trim();
    const consumerKey    = process.env['X_API_KEY']    ?? '';
    const consumerSecret = process.env['X_API_SECRET'] ?? '';

    if (denied) {
      // Clean up pending row
      await this.prisma.platformConnection.deleteMany({
        where: { platformId: 'x', accountId: `pending_${denied}` },
      });
      return res.redirect(`${webUrl}/publishing/accounts?error=access_denied`);
    }

    // Retrieve state from DB
    const pendingConn = await this.prisma.platformConnection.findFirst({
      where: { platformId: 'x', accountId: `pending_${oauthToken}` },
    });
    if (!pendingConn) {
      return res.redirect(`${webUrl}/publishing/accounts?error=invalid_state`);
    }

    let payload: StatePayload;
    let returnTo = '/publishing/accounts';
    try {
      payload = JSON.parse(this.enc.decrypt(pendingConn.encryptedTokens)) as StatePayload;
      returnTo = payload.returnTo ?? returnTo;
    } catch {
      return res.redirect(`${webUrl}${returnTo}?error=invalid_state`);
    }

    const { userId, rts: requestTokenSecret } = payload;

    // Clean up pending row
    await this.prisma.platformConnection.delete({ where: { id: pendingConn.id } });

    try {
      // Step 2: Exchange for access token
      const authHeader = oauthHeader(
        'POST', X_ACCESS_TOKEN, { oauth_verifier: oauthVerifier },
        consumerKey, consumerSecret, oauthToken, requestTokenSecret,
      );

      const accessResp = await axios.post<string>(X_ACCESS_TOKEN, null, {
        headers: { Authorization: authHeader },
        responseType: 'text',
      });

      const accessParams = new URLSearchParams(accessResp.data);
      const accessToken       = accessParams.get('oauth_token') ?? '';
      const accessTokenSecret = accessParams.get('oauth_token_secret') ?? '';
      const xUserId           = accessParams.get('user_id') ?? '';
      const screenName        = accessParams.get('screen_name') ?? '';

      // Fetch display name
      let displayName = screenName;
      try {
        const verifyHeader = oauthHeader(
          'GET', X_VERIFY_CREDS, {},
          consumerKey, consumerSecret, accessToken, accessTokenSecret,
        );
        const profileResp = await axios.get<{ name: string }>(X_VERIFY_CREDS, {
          headers: { Authorization: verifyHeader },
        });
        displayName = profileResp.data.name ?? screenName;
      } catch { /* non-fatal */ }

      const encryptedTokens = this.enc.encrypt(
        JSON.stringify({ accessToken, accessTokenSecret, xUserId, screenName }),
      );

      await this.prisma.platformConnection.upsert({
        where: { userId_platformId_accountId: { userId, platformId: 'x', accountId: xUserId } },
        create: { userId, platformId: 'x', accountId: xUserId, accountName: displayName, encryptedTokens, scopes: 'write' },
        update: { accountName: displayName, encryptedTokens, scopes: 'write' },
      });

      this.logger.log(`X connected: @${screenName} (${xUserId})`);
      return res.redirect(`${webUrl}${returnTo}?connected=x`);
    } catch (err) {
      const detail = (err as { response?: { data?: unknown } })?.response?.data;
      this.logger.error('X OAuth 1.0a callback failed', detail ?? String(err));
      return res.redirect(`${webUrl}${returnTo}?error=x_auth_failed`);
    }
  }
}
