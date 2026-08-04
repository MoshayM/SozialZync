'use client';
import { Component, type ReactNode, type ErrorInfo } from 'react';
import * as Sentry from '@sentry/nextjs';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  eventId: string | null;
}

export class SentryErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false, eventId: null };

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    const eventId = Sentry.captureException(error, {
      extra: { componentStack: info.componentStack },
    });
    this.setState({ eventId: eventId ?? null });
  }

  override render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F3FB] p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-[#ECECF3] p-8 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center" style={{ background: '#FEF2F2' }}>
            <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
          </div>
          <h2 className="text-[17px] font-bold text-[#1E1B2E] mb-2">Something went wrong</h2>
          <p className="text-sm text-[#6b6880] mb-6">
            We&apos;ve been notified and are looking into it. Try refreshing the page.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: 'linear-gradient(135deg,#6D4AE0,#5B21B6)' }}
            >
              Refresh page
            </button>
            {this.state.eventId && (
              <button
                type="button"
                onClick={() => Sentry.showReportDialog({ eventId: this.state.eventId! })}
                className="px-4 py-2 rounded-xl text-sm font-semibold border border-[#ECECF3] text-[#3d3a52] hover:bg-[#F6F5FC] transition-colors"
              >
                Report issue
              </button>
            )}
          </div>
          {this.state.eventId && (
            <p className="mt-4 text-xs text-[#a8a5b8]">Error ID: {this.state.eventId}</p>
          )}
        </div>
      </div>
    );
  }
}
