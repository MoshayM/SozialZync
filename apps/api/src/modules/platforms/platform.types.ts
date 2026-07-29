export interface PublishOptions {
  title: string;
  description?: string;
  tags?: string[];
  videoFilePath?: string;
  thumbnailFilePath?: string;
  scheduledAt?: Date;
  privacyStatus?: 'public' | 'private' | 'unlisted';
}

export interface PublishResult {
  platformPostId: string;
  url: string;
  publishedAt: Date;
}

export interface ConnectionStatus {
  connected: boolean;
  accountName?: string;
  accountId?: string;
  expiresAt?: Date;
}

export interface IPlatformProvider {
  readonly platformId: string;
  readonly name: string;
  getConnectionStatus(userId: string): Promise<ConnectionStatus>;
  getOAuthUrl(userId: string, returnUrl: string): Promise<string>;
  disconnect(userId: string): Promise<void>;
  publish(userId: string, opts: PublishOptions): Promise<PublishResult>;
  schedule(userId: string, opts: PublishOptions & { scheduledAt: Date }): Promise<PublishResult>;
  validate(opts: PublishOptions): { valid: boolean; errors: string[] };
}
