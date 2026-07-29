import { Injectable } from '@nestjs/common';
import { IPlatformProvider, PublishOptions, PublishResult, ConnectionStatus } from '../platform.types';

@Injectable()
export class InstagramPlatformProvider implements IPlatformProvider {
  readonly platformId = 'instagram';
  readonly name = 'Instagram';

  async getConnectionStatus(_userId: string): Promise<ConnectionStatus> {
    return { connected: false };
  }

  async getOAuthUrl(_userId: string, _returnUrl: string): Promise<string> {
    throw new Error('Instagram OAuth not yet implemented');
  }

  async disconnect(_userId: string): Promise<void> { /* no-op */ }

  async publish(_userId: string, _opts: PublishOptions): Promise<PublishResult> {
    throw new Error('Instagram publishing not yet implemented');
  }

  async schedule(_userId: string, _opts: PublishOptions & { scheduledAt: Date }): Promise<PublishResult> {
    throw new Error('Instagram scheduling not yet implemented');
  }

  validate(opts: PublishOptions): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!opts.title) errors.push('Title is required');
    if (!opts.videoFilePath) errors.push('Video/image file is required');
    return { valid: errors.length === 0, errors };
  }
}
