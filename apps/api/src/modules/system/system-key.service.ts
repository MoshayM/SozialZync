import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';

function getEncKey(): Buffer {
  const raw = process.env['PROVIDER_KEY_SECRET'];
  if (!raw && process.env['NODE_ENV'] === 'production') {
    throw new Error('PROVIDER_KEY_SECRET must be set in production');
  }
  return createHash('sha256').update(raw ?? 'dev-secret-32bytes-exactly-here!!').digest();
}

function encrypt(plain: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', getEncKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + enc.toString('hex');
}

function decrypt(cipherText: string): string {
  const [ivHex, encHex] = cipherText.split(':');
  if (!ivHex || !encHex) return '';
  const decipher = createDecipheriv('aes-256-cbc', getEncKey(), Buffer.from(ivHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]).toString('utf8');
}

const PLACEHOLDER_VALS = new Set(['sk_test_cflocalstripe', 'pk_test_cflocalstripe', 'whsec_cf_local_test_secret']);

@Injectable()
export class SystemKeyService {
  constructor(private readonly prisma: PrismaService) {}

  /** Resolve a key: DB override first, then process.env fallback. */
  async resolve(envKey: string): Promise<string> {
    const row = await this.prisma.systemProviderKey.findUnique({ where: { envKey } }).catch(() => null);
    if (row) return decrypt(row.encryptedValue);
    return process.env[envKey] ?? '';
  }

  async isConfiguredInDb(envKey: string): Promise<boolean> {
    const count = await this.prisma.systemProviderKey.count({ where: { envKey } }).catch(() => 0);
    return count > 0;
  }

  async upsert(envKey: string, plainValue: string, updatedBy: string): Promise<void> {
    const encryptedValue = encrypt(plainValue);
    await this.prisma.systemProviderKey.upsert({
      where: { envKey },
      update: { encryptedValue, updatedBy },
      create: { envKey, encryptedValue, updatedBy },
    });
  }

  async delete(envKey: string): Promise<void> {
    await this.prisma.systemProviderKey.deleteMany({ where: { envKey } });
  }

  /** Returns all env-key entries stored in DB (decrypted values excluded — admin use only). */
  async listStoredKeys(): Promise<string[]> {
    const rows = await this.prisma.systemProviderKey.findMany({ select: { envKey: true } }).catch(() => []);
    return rows.map((r) => r.envKey);
  }

  isPlaceholder(val: string): boolean {
    return PLACEHOLDER_VALS.has(val);
  }
}
