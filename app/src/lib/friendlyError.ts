export const SERVICE_UNAVAILABLE_MESSAGE =
  "We can't reach our servers right now. Check your internet connection and try again in a minute — if it keeps happening, the service may be briefly down.";

// Browsers word a failed fetch differently (Chrome, Firefox, Safari), and
// supabase-js wraps it as AuthRetryableFetchError with status 0.
const NETWORK_PATTERNS = [/failed to fetch/i, /networkerror/i, /load failed/i, /network request failed/i, /fetch failed/i];

export function isNetworkError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: unknown; message?: unknown; status?: unknown };
  if (e.name === "AuthRetryableFetchError") return true;
  const message = typeof e.message === "string" ? e.message : "";
  return NETWORK_PATTERNS.some((p) => p.test(message));
}

export function friendlyErrorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (isNetworkError(err)) return SERVICE_UNAVAILABLE_MESSAGE;
  if (err && typeof err === "object" && typeof (err as { message?: unknown }).message === "string") {
    const message = (err as { message: string }).message.trim();
    if (message && message !== "{}") return message;
  }
  return fallback;
}
