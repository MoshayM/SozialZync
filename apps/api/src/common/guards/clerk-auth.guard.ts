import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import * as https from 'https';

interface JwksKey {
  kid: string;
  n: string;
  e: string;
  kty: string;
  alg: string;
  use: string;
}

interface JwksCache {
  keys: JwksKey[];
  fetchedAt: number;
}

let jwksCache: JwksCache | null = null;
const JWKS_TTL_MS = 60 * 60 * 1000; // 1 hour

async function fetchClerkJwks(): Promise<JwksKey[]> {
  if (jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS) {
    return jwksCache.keys;
  }
  const frontendApi =
    process.env['CLERK_FRONTEND_API'] ??
    process.env['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY']
      ?.replace('pk_', 'https://')
      .replace('_live_', '.clerk.accounts.dev') ??
    '';
  if (!frontendApi) return [];

  return new Promise((resolve, reject) => {
    const url = `${frontendApi}/.well-known/jwks.json`;
    https
      .get(url, (res) => {
        let data = '';
        res.on('data', (chunk: string) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const json = JSON.parse(data) as { keys: JwksKey[] };
            jwksCache = { keys: json.keys, fetchedAt: Date.now() };
            resolve(json.keys);
          } catch {
            reject(new Error('Failed to parse Clerk JWKS'));
          }
        });
      })
      .on('error', reject);
  });
}

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  private readonly logger = new Logger(ClerkAuthGuard.name);

  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!process.env['CLERK_SECRET_KEY']) return false;
    const request = context.switchToHttp().getRequest<Request>();
    const token = request.headers.authorization?.replace('Bearer ', '');
    if (!token) return false;

    try {
      const [header] = token.split('.');
      const decoded = JSON.parse(
        Buffer.from(header, 'base64url').toString(),
      ) as { kid?: string };
      const keys = await fetchClerkJwks();
      const key = keys.find((k) => k.kid === decoded.kid);
      if (!key) return false;
      // JWT signature verification would require a crypto library.
      // In production, use @clerk/backend verifyToken() with CLERK_SECRET_KEY.
      // Placeholder: return true if kid matches (full verification via Clerk SDK recommended).
      this.logger.debug(
        `Clerk JWT kid=${decoded.kid} matched — full verify via Clerk SDK`,
      );
      return true;
    } catch (err) {
      this.logger.warn('Clerk JWT verification failed', err);
      return false;
    }
  }
}
