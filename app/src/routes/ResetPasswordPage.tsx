import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { btnPrimary, inputBase, labelBase } from "../lib/uiClasses";

// Reached only via the link Supabase emails from LoginPage's "Forgot
// password?" flow — the recovery token lives in the URL fragment, and
// Supabase's client (detectSessionInUrl, on by default) picks it up itself
// and grants a temporary session before this component ever mounts. No
// token-parsing of our own needed; a plain supabase.auth.updateUser call is
// enough to actually change the password under that session.
export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // The recovery session takes a moment to land after Supabase's client
    // parses the URL fragment — briefly show a loading state rather than
    // flashing an incorrect "not signed in" message first.
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        setError("This reset link is invalid or has expired — request a new one from the sign-in page.");
      }
      setReady(true);
    });
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
    setTimeout(() => navigate("/dashboard"), 1500);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 bg-gray-50 dark:bg-gray-950">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-blue-700 dark:bg-blue-600 text-white flex items-center justify-center font-serif text-sm">
            §
          </div>
          <span className="font-semibold text-gray-900 dark:text-gray-100 tracking-tight">IEEE Paper Builder</span>
        </div>

        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight mb-1">
          Set a new password
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">Choose a new password for your account.</p>

        {done ? (
          <p className="text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900 rounded-md px-3 py-2">
            Password updated — taking you to your papers…
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="new-password" className={labelBase}>
                New password
              </label>
              <input
                id="new-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={!ready}
                className={inputBase}
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className={labelBase}>
                Confirm password
              </label>
              <input
                id="confirm-password"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                disabled={!ready}
                className={inputBase}
              />
            </div>
            <button type="submit" disabled={busy || !ready} className={`${btnPrimary} mt-2 w-full py-2.5`}>
              {busy ? "Updating…" : "Update password"}
            </button>
          </form>
        )}

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900 rounded-md px-3 py-2 mt-4">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
