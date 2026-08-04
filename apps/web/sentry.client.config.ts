import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // Performance: 10% in prod, 100% in dev
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Session replay: record 10% of sessions, 100% of sessions with errors
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Only run Sentry when DSN is configured
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),

  // Release tracking — injected by CI via NEXT_PUBLIC_SENTRY_RELEASE env var
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
    Sentry.browserTracingIntegration(),
  ],

  // Ignore common browser noise
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    /^Network Error$/,
    /^Request aborted$/,
    'Non-Error promise rejection captured',
  ],

  // Don't send errors from localhost
  beforeSend(event) {
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      return null;
    }
    return event;
  },
});
