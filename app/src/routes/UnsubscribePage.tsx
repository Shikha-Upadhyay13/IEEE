import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { usePageMeta } from "../lib/usePageMeta";
import { BrandMark } from "../components/BrandMark";
import { btnPrimary } from "../lib/uiClasses";
import { friendlyErrorMessage } from "../lib/friendlyError";
import { unsubscribe } from "../lib/notificationPrefs";

// Opened from the link in notification email. It waits for a click because
// mail scanners open links on their own; mail clients that support one-click
// unsubscribe (RFC 8058) POST to the Edge Function instead and never land here.
export function UnsubscribePage() {
  usePageMeta({ title: "Unsubscribe", noindex: true });
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<"idle" | "busy" | "done" | "invalid">(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token) ? "idle" : "invalid",
  );
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setState("busy");
    setError(null);
    try {
      setState((await unsubscribe(token)) ? "done" : "invalid");
    } catch (err) {
      setError(friendlyErrorMessage(err));
      setState("idle");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 bg-canvas">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2">
          <BrandMark />
          <span className="font-display font-semibold text-ink tracking-tight">IEEE Paper Builder</span>
        </div>

        <h1 className="text-2xl font-semibold text-ink tracking-tight mb-2">Notification email</h1>
        {state === "done" ? (
          <p className="text-sm text-muted" role="status">
            You won't get notification email any more. Your in-app inbox is unchanged, and you can turn email back on
            in <Link to="/settings" className="text-accent hover:underline">Settings</Link>.
          </p>
        ) : state === "invalid" ? (
          <p className="text-sm text-muted" role="alert">
            This unsubscribe link isn't valid. You can turn notification email off in{" "}
            <Link to="/settings" className="text-accent hover:underline">Settings</Link>.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted mb-6">
              Stop emails about comments, mentions, suggestions and invitations? Sign-in and account security email
              still comes through.
            </p>
            <button type="button" onClick={confirm} disabled={state === "busy"} className={btnPrimary}>
              {state === "busy" ? "Unsubscribing…" : "Unsubscribe"}
            </button>
            {error && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-2" role="alert">
                {error}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
