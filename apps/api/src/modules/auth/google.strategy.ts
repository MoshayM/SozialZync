import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Google OAuth strategy — handles upsert of users from Google OAuth callbacks.
 * The actual OAuth flow (auth URL building, code exchange, PKCE) is handled by
 * GoogleAdapter in providers/google.adapter.ts via OAuthService.
 *
 * This strategy validates and persists the user profile returned by GoogleAdapter.exchange().
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name);

  constructor(private readonly prisma: PrismaService) {
    super({ usernameField: 'email', passwordField: 'name', passReqToCallback: true });
  }

  /**
   * Validate and upsert user from Google OAuth profile.
   * Called after GoogleAdapter.exchange() succeeds and returns an OAuthProfile.
   *
   * @param req Express request (provides context for logging/audit)
   * @param email Email from Google profile
   * @param name Display name from Google profile (may be null)
   */
  async validate(req: any, email: string, name?: string | null) {
    if (!email) {
      this.logger.warn('Google profile validation failed: missing email');
      return null;
    }

    try {
      // Upsert user by email — create if not exists, update if exists
      const user = await this.prisma.user.upsert({
        where: { email },
        update: {
          name: name || undefined,
        },
        create: {
          email,
          name: name || email.split('@')[0],
          role: 'MEMBER',
        },
      });
      return user;
    } catch (err: unknown) {
      this.logger.error(`Google OAuth user upsert failed: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }
}
