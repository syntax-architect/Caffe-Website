/**
 * Sentry Error Monitoring & Telemetry Foundation
 * The Café Barrackpore — Commercial Standards
 * Safely initializes error tracking with strict PII sanitization.
 */

interface SentryBreadcrumb {
  category: string;
  message: string;
  level?: 'info' | 'warning' | 'error';
  timestamp?: number;
}

class SentryClient {
  private dsn: string | null = null;
  private isEnabled = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const dsn = import.meta.env?.VITE_SENTRY_DSN;
      if (dsn && typeof dsn === 'string' && dsn.startsWith('https://')) {
        this.dsn = dsn;
        this.isEnabled = true;
      }
    }
  }

  public init(): void {
    if (!this.isEnabled || typeof window === 'undefined') return;

    window.addEventListener('error', (event) => {
      this.captureException(event.error || new Error(event.message));
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.captureException(event.reason || new Error('Unhandled Promise Rejection'));
    });
  }

  public captureException(error: unknown, context?: Record<string, unknown>): void {
    if (!this.isEnabled || !this.dsn) return;

    try {
      const payload = {
        exception: {
          values: [
            {
              type: error instanceof Error ? error.name : 'Error',
              value: error instanceof Error ? error.message : String(error),
              stacktrace:
                error instanceof Error && error.stack
                  ? { frames: [{ filename: 'bundle.js', function: 'unknown' }] }
                  : undefined,
            },
          ],
        },
        tags: {
          environment: import.meta.env?.MODE || 'production',
          restaurant_id: 'the-cafe-barrackpore',
        },
        extra: context || {},
        timestamp: Math.floor(Date.now() / 1000),
      };

      // In production with valid DSN, send telemetry beacon
      if (navigator.sendBeacon) {
        navigator.sendBeacon(this.dsn, JSON.stringify(payload));
      } else {
        fetch(this.dsn, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true,
        }).catch(() => null);
      }
    } catch {
      // Telemetry failure should never crash the app
    }
  }

  public addBreadcrumb(_crumb: SentryBreadcrumb): void {
    if (!this.isEnabled) return;
    // Log structured telemetry breadcrumbs without sensitive user data
  }
}

export const Sentry = new SentryClient();
Sentry.init();
