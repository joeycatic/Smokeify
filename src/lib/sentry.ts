import "server-only";
import * as Sentry from "@sentry/nextjs";

/**
 * Captures an exception to Sentry. No-ops when SENTRY_DSN is not configured.
 * Always safe to call — never throws.
 */
export function captureException(
  error: unknown,
  context?: Record<string, unknown>
): void {
  if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  try {
    Sentry.captureException(error, context ? { extra: context } : undefined);
  } catch {
    // Never let Sentry reporting break the app
  }
}
