import { useEffect, useState } from "react";
import { cardBase } from "../../lib/uiClasses";
import { friendlyErrorMessage } from "../../lib/friendlyError";
import {
  NOTIFICATION_EVENTS,
  loadEmailEnabled,
  loadPreferences,
  savePreference,
  setEmailEnabled,
  withDefaults,
  type Channel,
  type Preference,
} from "../../lib/notificationPrefs";

export function NotificationSettings({ userId, className = "" }: { userId: string; className?: string }) {
  const [prefs, setPrefs] = useState<Preference[]>(() => withDefaults([]));
  const [emailOn, setEmailOn] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadPreferences(), loadEmailEnabled()])
      .then(([p, e]) => {
        if (cancelled) return;
        setPrefs(p);
        setEmailOn(e);
        setLoaded(true);
      })
      .catch((err) => !cancelled && setError(friendlyErrorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, []);

  function toggle(pref: Preference, channel: Channel) {
    const next = { ...pref, [channel]: !pref[channel] };
    const replace = (p: Preference) => setPrefs((all) => all.map((x) => (x.kind === p.kind ? p : x)));
    replace(next);
    setError(null);
    savePreference(userId, next).catch((err) => {
      replace(pref);
      setError(friendlyErrorMessage(err));
    });
  }

  function toggleEmail() {
    const next = !emailOn;
    setEmailOn(next);
    setError(null);
    setEmailEnabled(next).catch((err) => {
      setEmailOn(!next);
      setError(friendlyErrorMessage(err));
    });
  }

  return (
    <div className={`${cardBase} p-6 ${className}`}>
      <h2 className="text-base font-semibold text-ink mb-1">Notifications</h2>
      <p className="text-sm text-muted mb-4">
        Choose what reaches your inbox and your email. Email waits ten minutes and skips anything you've already
        seen, then bundles the rest into one message. You can also quiet a single paper from its Feedback panel.
      </p>

      <label className="flex items-center gap-2 text-sm text-ink mb-4">
        <input type="checkbox" checked={emailOn} onChange={toggleEmail} disabled={!loaded} className="accent-accent" />
        Send me notification email
      </label>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th className="font-medium pb-2">Event</th>
            <th className="font-medium pb-2 w-20 text-center">In app</th>
            <th className="font-medium pb-2 w-20 text-center">Email</th>
          </tr>
        </thead>
        <tbody>
          {NOTIFICATION_EVENTS.map(({ kind, label, hint }) => {
            const pref = prefs.find((p) => p.kind === kind)!;
            return (
              <tr key={kind} className="border-t border-line">
                <td className="py-2 pr-2">
                  <span className="block text-ink">{label}</span>
                  <span className="block text-xs text-muted">{hint}</span>
                </td>
                <td className="py-2 text-center">
                  <input
                    type="checkbox"
                    checked={pref.in_app}
                    onChange={() => toggle(pref, "in_app")}
                    disabled={!loaded}
                    aria-label={`${label} in app`}
                    className="accent-accent"
                  />
                </td>
                <td className="py-2 text-center">
                  <input
                    type="checkbox"
                    checked={pref.email}
                    onChange={() => toggle(pref, "email")}
                    disabled={!loaded || !emailOn}
                    aria-label={`${label} by email`}
                    className="accent-accent"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="text-xs text-muted mt-4">
        Sign-in, password and other account security email always comes through.
      </p>
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 mt-2" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
