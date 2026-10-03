/**
 * Production-Safe Logging & Error Sanitization Foundation
 * The Café Barrackpore — Commercial Production Readiness (Phase 1K)
 */

const SENSITIVE_KEY_PATTERN = /password|secret|token|api_key|service_role|card|cvv|authorization|cookie/i;

/**
 * Sanitizes arbitrary objects, payloads, or strings to strip credentials,
 * passwords, payment tokens, and service role keys before logging.
 */
export function sanitizeLogData(input: unknown): unknown {
  if (input === null || input === undefined) return input;

  if (typeof input === 'string') {
    // Redact JWT tokens (Bearer eyJ...)
    if (input.includes('Bearer ') || input.startsWith('eyJ')) {
      return '[REDACTED_TOKEN]';
    }
    // Redact Stripe / Razorpay key strings
    if (input.startsWith('sk_') || input.startsWith('rzp_') || input.startsWith('whsec_')) {
      return '[REDACTED_SECRET]';
    }
    return input;
  }

  if (Array.isArray(input)) {
    return input.map(sanitizeLogData);
  }

  if (typeof input === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeLogData(value);
      }
    }
    return sanitized;
  }

  return input;
}

import { Sentry } from '../lib/sentry';

const isDev = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.DEV : false;

export const logger = {
  info: (context: string, message: string, meta?: unknown) => {
    if (isDev) {
      console.info(`[${context}] ${message}`, meta ? sanitizeLogData(meta) : '');
    }
  },

  warn: (context: string, message: string, meta?: unknown) => {
    console.warn(`[${context}] ${message}`, meta ? sanitizeLogData(meta) : '');
  },

  error: (context: string, message: string, err?: unknown) => {
    // 1. Telemetry error dispatch to Sentry
    Sentry.captureException(err, { context, message });

    // 2. In production, strictly hide stack traces and internal metadata
    if (!isDev) {
      const safeMessage = err instanceof Error ? `${err.name}: ${err.message}` : 'Operation failed';
      console.error(`[${context}] ${message} - ${safeMessage}`);
      return;
    }

    const sanitizedErr = err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : sanitizeLogData(err);
    console.error(`[${context}] ${message}`, sanitizedErr);
  },
};

/**
 * Transforms backend, SQL, or network exceptions into safe, reassuring
 * customer-facing error messages that never leak internal details.
 */
export function sanitizeCustomerError(
  rawError: unknown,
  fallbackMessage = 'Unable to complete your request at this time. Please try again or speak with our staff.'
): string {
  if (!rawError) return fallbackMessage;

  const errorString = String(typeof rawError === 'object' && rawError !== null && 'message' in rawError ? (rawError as any).message : rawError);

  // If already a clean user-facing validation message, keep it
  if (
    errorString.includes('Please enter') ||
    errorString.includes('Please provide') ||
    errorString.includes('sold out') ||
    errorString.includes('empty order') ||
    errorString.includes('Table') ||
    errorString.includes('minimum 2 characters')
  ) {
    return errorString;
  }

  // Database / Network technical errors
  if (
    errorString.includes('violates') ||
    errorString.includes('PGRST') ||
    errorString.includes('syntax error') ||
    errorString.includes('Postgres') ||
    errorString.includes('relation') ||
    errorString.includes('column') ||
    errorString.includes('ECONNREFUSED') ||
    errorString.includes('Fetch') ||
    errorString.includes('status code')
  ) {
    return fallbackMessage;
  }

  return errorString.length < 120 ? errorString : fallbackMessage;
}
