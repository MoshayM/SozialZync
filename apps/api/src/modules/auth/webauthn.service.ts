import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from '@simplewebauthn/server';
import { isoBase64URL, isoUint8Array } from '@simplewebauthn/server/helpers';
import type { PasskeyCredential, User } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthService, type AuthTokens } from './auth.service';
import type { SessionMeta } from './sessions.service';

// ── Env helpers ───────────────────────────────────────────────────────────────

function rpId(): string {
  return process.env['WEBAUTHN_RP_ID'] ?? 'localhost';
}

function rpName(): string {
  return process.env['WEBAUTHN_RP_NAME'] ?? 'CreatorForce';
}

function origin(): string {
  return process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3007';
}

/** Challenge TTL: 5 minutes. */
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class WebAuthnService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  // ── Registration ─────────────────────────────────────────────────────────────

  /**
   * Generates WebAuthn registration options for an authenticated user.
   * Stores a short-lived challenge in WebAuthnChallenge.
   */
  async generateRegistrationOptions(
    userId: string,
    userEmail: string,
    userName: string,
  ): Promise<PublicKeyCredentialCreationOptionsJSON> {
    // Fetch existing credential IDs so the authenticator won't re-register the same device.
    const existing = await this.prisma.passkeyCredential.findMany({
      where: { userId },
      select: { credentialId: true, transports: true },
    });

    const excludeCredentials = existing.map((c) => ({
      id: c.credentialId,
      // @reason: SimpleWebAuthn v13 accepts the transport union type; casting from string[] is correct here
      transports: c.transports as AuthenticatorTransportFuture[],
    }));

    const options = await generateRegistrationOptions({
      rpID: rpId(),
      rpName: rpName(),
      userID: isoUint8Array.fromUTF8String(userId),
      userName: userEmail,
      userDisplayName: userName || userEmail,
      excludeCredentials,
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    // Persist challenge with 5-minute TTL (scoped to the user for bookkeeping).
    await this.prisma.webAuthnChallenge.create({
      data: {
        challenge: options.challenge,
        userId,
        expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
      },
    });

    return options;
  }

  /**
   * Verifies the authenticator's registration response and stores the credential.
   */
  async verifyRegistration(
    userId: string,
    credential: RegistrationResponseJSON,
    credentialName?: string,
  ): Promise<PasskeyCredential> {
    const challengeRow = await this.consumeChallenge(credential.response.clientDataJSON);

    if (challengeRow.userId !== userId) {
      throw new BadRequestException('Challenge does not belong to this user');
    }

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: origin(),
      expectedRPID: rpId(),
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new BadRequestException('Passkey registration verification failed');
    }

    const {
      credential: verifiedCredential,
      credentialDeviceType,
      credentialBackedUp,
    } = verification.registrationInfo;

    // verifiedCredential.id is already a Base64URLString; publicKey is a Uint8Array_
    const credentialId = verifiedCredential.id;
    const publicKey = isoBase64URL.fromBuffer(verifiedCredential.publicKey);

    const passkey = await this.prisma.passkeyCredential.create({
      data: {
        userId,
        credentialId,
        publicKey,
        counter: verifiedCredential.counter,
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        transports: (credential.response.transports ?? []) as string[],
        name: credentialName ?? null,
      },
    });

    await this.prisma.auditLog.create({
      data: { userId, action: 'auth.passkey_registered', meta: { credentialId, name: credentialName ?? null } },
    });

    return passkey;
  }

  // ── Authentication ───────────────────────────────────────────────────────────

  /**
   * Generates WebAuthn authentication options (no user needed — discoverable credentials).
   * Stores a short-lived, anonymous challenge in WebAuthnChallenge.
   */
  async generateAuthenticationOptions(): Promise<PublicKeyCredentialRequestOptionsJSON> {
    const options = await generateAuthenticationOptions({
      rpID: rpId(),
      userVerification: 'preferred',
    });

    await this.prisma.webAuthnChallenge.create({
      data: {
        challenge: options.challenge,
        userId: null,
        expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
      },
    });

    return options;
  }

  /**
   * Verifies the authentication response, updates the credential counter,
   * and issues a session via AuthService.issueSessionTokens().
   */
  async verifyAuthentication(
    credential: AuthenticationResponseJSON,
    meta: SessionMeta = {},
  ): Promise<AuthTokens & { user: User }> {
    const challengeRow = await this.consumeChallenge(credential.response.clientDataJSON);

    // Look up the stored credential by its ID (base64url).
    const storedCredential = await this.prisma.passkeyCredential.findUnique({
      where: { credentialId: credential.id },
      include: { user: true },
    });

    if (!storedCredential) {
      throw new UnauthorizedException('Passkey not found');
    }

    const publicKeyBuffer = isoBase64URL.toBuffer(storedCredential.publicKey);

    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: origin(),
      expectedRPID: rpId(),
      credential: {
        id: storedCredential.credentialId,
        publicKey: publicKeyBuffer,
        counter: Number(storedCredential.counter),
        // @reason: Prisma returns String[], SimpleWebAuthn expects AuthenticatorTransport union; runtime values are valid transport strings
        transports: storedCredential.transports as AuthenticatorTransportFuture[],
      },
    });

    if (!verification.verified) {
      throw new UnauthorizedException('Passkey authentication failed');
    }

    const { newCounter } = verification.authenticationInfo;

    // Update counter and lastUsedAt.
    await this.prisma.passkeyCredential.update({
      where: { id: storedCredential.id },
      data: {
        counter: newCounter,
        lastUsedAt: new Date(),
      },
    });

    const user = storedCredential.user;

    const tokens = await this.authService.issueSessionTokens(user.id, user.email, meta);

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'auth.passkey_login',
        meta: { credentialId: storedCredential.credentialId },
      },
    });

    return { ...tokens, user };
  }

  // ── Credential management ─────────────────────────────────────────────────────

  async listCredentials(userId: string): Promise<PasskeyCredential[]> {
    return this.prisma.passkeyCredential.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async deleteCredential(userId: string, credentialDbId: string): Promise<void> {
    const row = await this.prisma.passkeyCredential.findUnique({
      where: { id: credentialDbId },
      select: { userId: true, credentialId: true },
    });

    if (!row) throw new NotFoundException('Passkey not found');
    if (row.userId !== userId) throw new UnauthorizedException('Forbidden');

    await this.prisma.passkeyCredential.delete({ where: { id: credentialDbId } });

    await this.prisma.auditLog.create({
      data: { userId, action: 'auth.passkey_deleted', meta: { credentialId: row.credentialId } },
    });
  }

  // ── Internal helpers ──────────────────────────────────────────────────────────

  /**
   * Decodes the clientDataJSON to extract the challenge, looks it up in the DB,
   * validates expiry, deletes it (one-time use), and returns the row.
   */
  private async consumeChallenge(clientDataJSONBase64: string): Promise<{
    id: string;
    challenge: string;
    userId: string | null;
    expiresAt: Date;
    createdAt: Date;
  }> {
    let challenge: string;
    try {
      const clientDataRaw = isoBase64URL.toBuffer(clientDataJSONBase64);
      // @reason: clientDataJSON is a JSON byte array; TextDecoder + JSON.parse is the standard decode path
      const clientData = JSON.parse(new TextDecoder().decode(clientDataRaw)) as { challenge?: string };
      if (typeof clientData.challenge !== 'string') {
        throw new Error('missing challenge field');
      }
      // clientData.challenge is base64url; convert to match what we stored from generateOptions
      challenge = clientData.challenge;
    } catch {
      throw new BadRequestException('Invalid clientDataJSON');
    }

    const row = await this.prisma.webAuthnChallenge.findUnique({
      where: { challenge },
    });

    if (!row) throw new BadRequestException('Challenge not found or already used');
    if (row.expiresAt <= new Date()) {
      await this.prisma.webAuthnChallenge.delete({ where: { id: row.id } }).catch(() => undefined);
      throw new BadRequestException('Challenge has expired');
    }

    // Delete immediately — challenges are single-use.
    await this.prisma.webAuthnChallenge.delete({ where: { id: row.id } });

    return row;
  }
}
