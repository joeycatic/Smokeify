import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    // Capture 10% of sessions for replay in production, 100% in dev
    replaysSessionSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    // Always capture replays for sessions with errors
    replaysOnErrorSampleRate: 1.0,
    // Capture 10% of transactions for performance monitoring
    tracesSampleRate: 0.1,
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
  });
}
