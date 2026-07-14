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
  const [mode, setMode] = useState<"signin" | "signup">("signin");
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
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // With email confirmation disabled, signUp returns an active session
        // immediately — the user is already logged in, nothing to check.
        // With it enabled, no session comes back until they click the link.
        if (data.session) {
          navigate("/");
        } else {
          setMessage("Check your email to confirm your account, then sign in.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/");
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
      <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-slate-900 via-indigo-950 to-indigo-900 text-white px-12 py-12 relative overflow-hidden">
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
          <p className="text-indigo-200/80 text-sm leading-relaxed mb-8">
            A FlowCV-style builder for IEEE conference papers — built for students
            turning project work into a submission-ready paper without touching
            LaTeX or wrestling with Word styles.
          </p>
          <ul className="flex flex-col gap-3">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-indigo-100/90">
                <span className="mt-0.5 flex-none w-4 h-4 rounded-full bg-indigo-400/20 border border-indigo-300/40 flex items-center justify-center text-[10px]">
                  ✓
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-indigo-300/50">
          Real two-column IEEE format — margins, fonts, and citation numbering, exactly to spec.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center px-6 py-12 bg-gray-50">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8 flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-indigo-600 text-white flex items-center justify-center font-serif text-sm">
              §
            </div>
            <span className="font-semibold text-gray-900 tracking-tight">IEEE Paper Builder</span>
          </div>

          <h2 className="text-2xl font-semibold text-gray-900 tracking-tight mb-1">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h2>
          <p className="text-sm text-gray-500 mb-8">
            {mode === "signin"
              ? "Sign in to continue working on your papers."
              : "Start writing — no credit card, no LaTeX."}
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
            <div>
              <label htmlFor="login-password" className={labelBase}>
                Password
              </label>
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
            <button type="submit" disabled={busy} className={`${btnPrimary} mt-2 w-full py-2.5`}>
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mt-4">
              {error}
            </p>
          )}
          {message && (
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-md px-3 py-2 mt-4">
              {message}
            </p>
          )}

          <p className="mt-6 text-sm text-gray-500">
            {mode === "signin" ? "Need an account?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="text-indigo-600 hover:text-indigo-700 font-medium hover:underline"
            >
              {mode === "signin" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
