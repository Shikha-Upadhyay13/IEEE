let sentry = null;

export async function initMonitoring(serviceName) {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return false;
  try {
    sentry = await import("@sentry/node");
    sentry.init({
      dsn,
      environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
      tracesSampleRate: 0,
      initialScope: { tags: { service: serviceName } },
    });
    return true;
  } catch (err) {
    console.error("Sentry failed to initialise:", err);
    sentry = null;
    return false;
  }
}

export function captureError(err, context = {}) {
  if (!sentry) return;
  sentry.captureException(err, { extra: context });
}
