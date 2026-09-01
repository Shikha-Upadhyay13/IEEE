import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { btnPrimary, inputBase, labelBase } from "../lib/uiClasses";

const FEATURES = [
  "Drag-and-drop editing, no LaTeX required",
  "Live, always-accurate IEEE two-column preview",
  "One-click, submission-ready PDF export",
];

export function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      if (mode === "forgot") {
        // Supabase emails a link to /reset-password (see ResetPasswordPage)
        // carrying a recovery token in the URL fragment — its client picks
        // that up automatically and grants a temporary session there, no
        // token-handling of our own needed.
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setMessage("Check your email for a link to reset your password.");
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // With email confirmation disabled, signUp returns an active session
        // immediately — the user is already logged in, nothing to check.
        // With it enabled, no session comes back until they click the link.
        if (data.session) {
          navigate("/dashboard");
        } else {
          setMessage("Check your email to confirm your account, then sign in.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/dashboard");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Branding panel — hidden on small screens, where the form alone is plenty. */}
      <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-slate-950 via-gray-900 to-black text-white px-12 py-12 relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        <div className="relative flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-white/10 border border-white/20 flex items-center justify-center font-serif text-sm">
            §
          </div>
          <span className="font-semibold tracking-tight">IEEE Paper Builder</span>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight mb-4">
            Write your paper.
            <br />
            We'll handle the formatting.
          </h1>
          <p className="text-gray-300/90 text-sm leading-relaxed mb-8">
            A FlowCV-style builder for IEEE conference papers — built for students
            turning project work into a submission-ready paper without touching
            LaTeX or wrestling with Word styles.
          </p>
          <ul className="flex flex-col gap-3">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-gray-100/90">
                <span className="mt-0.5 flex-none w-4 h-4 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-[10px]">
                  ✓
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-gray-400/60">
          Real two-column IEEE format — margins, fonts, and citation numbering, exactly to spec.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center px-6 py-12 bg-gray-50 dark:bg-gray-950">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8 flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center font-serif text-sm">
              §
            </div>
            <span className="font-semibold text-gray-900 dark:text-gray-100 tracking-tight">IEEE Paper Builder</span>
          </div>

          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight mb-1">
            {mode === "signin" ? "Welcome back" : mode === "signup" ? "Create your account" : "Reset your password"}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
            {mode === "signin"
              ? "Sign in to continue working on your papers."
              : mode === "signup"
                ? "Start writing — no credit card, no LaTeX."
                : "Enter your email and we'll send you a reset link."}
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="login-email" className={labelBase}>
                Email
              </label>
              <input
                id="login-email"
                type="email"
                placeholder="you@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={inputBase}
              />
            </div>
            {mode !== "forgot" && (
              <div>
                <div className="flex items-baseline justify-between">
                  <label htmlFor="login-password" className={labelBase}>
                    Password
                  </label>
                  {mode === "signin" && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode("forgot");
                        setError(null);
                        setMessage(null);
                      }}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline mb-1"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className={inputBase}
                />
              </div>
            )}
            <button type="submit" disabled={busy} className={`${btnPrimary} mt-2 w-full py-2.5`}>
              {busy
                ? "Please wait…"
                : mode === "signin"
                  ? "Sign in"
                  : mode === "signup"
                    ? "Create account"
                    : "Send reset link"}
            </button>
          </form>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900 rounded-md px-3 py-2 mt-4">
              {error}
            </p>
          )}
          {message && (
            <p className="text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900 rounded-md px-3 py-2 mt-4">
              {message}
            </p>
          )}

          <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
            {mode === "forgot" ? (
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setError(null);
                  setMessage(null);
                }}
                className="text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700 dark:hover:text-blue-300 hover:underline"
              >
                ← Back to sign in
              </button>
            ) : (
              <>
                {mode === "signin" ? "Need an account?" : "Already have an account?"}{" "}
                <button
                  type="button"
                  onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                  className="text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700 dark:hover:text-blue-300 hover:underline"
                >
                  {mode === "signin" ? "Sign up" : "Sign in"}
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
