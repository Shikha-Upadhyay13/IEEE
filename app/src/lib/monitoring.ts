type SentryModule = typeof import("@sentry/react");
type PostHogClient = (typeof import("posthog-js"))["default"];

/** Product funnel: signup → first paper → first cite → first export. */
export type AnalyticsEvent =
  | "signed_up"
  | "paper_created"
  | "citation_inserted"
  | "pdf_exported"
  | "pdf_export_failed";

type EventProps = Record<string, string | number | boolean | undefined>;

let sentry: SentryModule | null = null;
let posthog: PostHogClient | null = null;
// Calls made before the lazily-loaded SDKs arrive are replayed once they do.
const pendingSentry: Array<(s: SentryModule) => void> = [];
const pendingPosthog: Array<(p: PostHogClient) => void> = [];
let initialised = false;

function withSentry(fn: (s: SentryModule) => void) {
  if (sentry) fn(sentry);
  else if (import.meta.env.VITE_SENTRY_DSN) pendingSentry.push(fn);
}

function withPosthog(fn: (p: PostHogClient) => void) {
  if (posthog) fn(posthog);
  else if (import.meta.env.VITE_POSTHOG_KEY) pendingPosthog.push(fn);
}

export function initMonitoring() {
  if (initialised || typeof window === "undefined") return;
  initialised = true;

  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (dsn) {
    import("@sentry/react")
      .then((mod) => {
        mod.init({
          dsn,
          environment: import.meta.env.MODE,
          tracesSampleRate: 0,
        });
        sentry = mod;
        pendingSentry.splice(0).forEach((fn) => fn(mod));
      })
      .catch((err) => console.error("Sentry failed to load:", err));
  }

  const key = import.meta.env.VITE_POSTHOG_KEY;
  if (key) {
    import("posthog-js")
      .then(({ default: client }) => {
        // Paper text is private: no autocapture, no session recording —
        // only the explicit funnel events below.
        client.init(key, {
          api_host: import.meta.env.VITE_POSTHOG_HOST ?? "https://us.i.posthog.com",
          autocapture: false,
          disable_session_recording: true,
          capture_pageview: true,
          person_profiles: "identified_only",
        });
        posthog = client;
        pendingPosthog.splice(0).forEach((fn) => fn(client));
      })
      .catch((err) => console.error("PostHog failed to load:", err));
  }
}

export function identifyUser(userId: string | null) {
  withSentry((s) => s.setUser(userId ? { id: userId } : null));
  withPosthog((p) => {
    if (userId) p.identify(userId);
    else p.reset();
  });
}

export function track(event: AnalyticsEvent, props?: EventProps) {
  withPosthog((p) => p.capture(event, props));
}

export function captureError(error: unknown, context?: Record<string, unknown>) {
  withSentry((s) => s.captureException(error, context ? { extra: context } : undefined));
}
