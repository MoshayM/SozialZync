import { Injectable } from '@nestjs/common';

interface SessionEntry {
  title: string;
  messages: unknown[];
  updatedAt: string;
}

const MAX_SESSIONS_PER_USER = 20;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class CopilotHistoryService {
  private readonly store = new Map<string, Map<string, SessionEntry>>();

  upsert(userId: string, sessionId: string, title: string, messages: unknown[]): void {
    if (!this.store.has(userId)) this.store.set(userId, new Map());
    const userSessions = this.store.get(userId)!;
    userSessions.set(sessionId, { title, messages, updatedAt: new Date().toISOString() });
    this.prune(userSessions);
  }

  list(userId: string): { id: string; title: string; messages: unknown[]; updatedAt: string }[] {
    const userSessions = this.store.get(userId);
    if (!userSessions) return [];
    const cutoff = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();
    return Array.from(userSessions.entries())
      .filter(([, s]) => s.updatedAt >= cutoff)
      .map(([id, s]) => ({ id, title: s.title, messages: s.messages, updatedAt: s.updatedAt }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, MAX_SESSIONS_PER_USER);
  }

  private prune(sessions: Map<string, SessionEntry>): void {
    const cutoff = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();
    for (const [id, s] of sessions.entries()) {
      if (s.updatedAt < cutoff) sessions.delete(id);
    }
    if (sessions.size > MAX_SESSIONS_PER_USER) {
      const sorted = Array.from(sessions.entries()).sort((a, b) =>
        a[1].updatedAt.localeCompare(b[1].updatedAt),
      );
      sorted.slice(0, sessions.size - MAX_SESSIONS_PER_USER).forEach(([id]) => sessions.delete(id));
    }
  }
}
