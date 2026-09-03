import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import { useTheme, type ThemeSetting } from "../lib/useTheme";
import { supabase } from "../supabaseClient";
import { btnDanger, btnSecondary, cardBase } from "../lib/uiClasses";
import { useConfirm } from "../components/ConfirmDialog";
import { DashboardSidebar } from "../components/dashboard/DashboardSidebar";
import { formatJoinDate } from "../lib/formatJoinDate";

const THEME_OPTIONS: { value: ThemeSetting; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

// A small mock browser/page preview instead of a plain labeled button — it
// actually shows what each mode looks like rather than just naming it.
function ThemePreview({ mode }: { mode: ThemeSetting }) {
  if (mode === "system") {
    return (
      <div className="w-full h-16 rounded-md overflow-hidden border border-gray-300 dark:border-gray-600 flex">
        <div className="w-1/2 bg-white flex flex-col gap-1.5 p-2">
          <div className="h-1.5 w-full rounded-full bg-gray-200" />
          <div className="h-1.5 w-2/3 rounded-full bg-gray-200" />
        </div>
        <div className="w-1/2 bg-gray-900 flex flex-col gap-1.5 p-2">
          <div className="h-1.5 w-full rounded-full bg-gray-700" />
          <div className="h-1.5 w-2/3 rounded-full bg-gray-700" />
        </div>
      </div>
    );
  }
  const isDark = mode === "dark";
  return (
    <div
      className={`w-full h-16 rounded-md overflow-hidden border flex flex-col gap-1.5 p-2 ${
        isDark ? "border-gray-600 bg-gray-900" : "border-gray-300 bg-white"
      }`}
    >
      <div className={`h-1.5 w-full rounded-full ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
      <div className={`h-1.5 w-2/3 rounded-full ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
      <div className={`h-1.5 w-1/2 rounded-full ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
    </div>
  );
}

export function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm();

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  async function handleClearConversations() {
    if (!user) return;
    const ok = await confirm({
      title: "Clear all conversations?",
      message: "Delete all Doc Buddy conversations? This can't be undone.",
      confirmLabel: "Clear all",
    });
    if (!ok) return;
    setClearing(true);
    setCleared(false);
    const { error } = await supabase.from("conversations").delete().eq("owner_id", user.id);
    setClearing(false);
    if (error) {
      console.error("Failed to clear conversations:", error);
      return;
    }
    setCleared(true);
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#f7f6f3] dark:bg-gray-950">
      <DashboardSidebar onSignOut={handleSignOut} />

      <div className="flex-1 min-w-0 px-4 py-6 sm:px-8 sm:py-10">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight mb-1">Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Your account, appearance, and Doc Buddy preferences.
        </p>

        {/* Account summary banner — full width, real content (avatar, join
            date) instead of just a nav link to the Profile page, so this
            page doesn't feel like a mostly-empty shell around three small
            cards. */}
        <div className={`${cardBase} p-6 mb-6 flex flex-wrap items-center gap-4`}>
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 dark:from-gray-300 dark:to-gray-100 text-white dark:text-gray-900 flex items-center justify-center text-xl font-semibold flex-none">
            {user?.email?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
              {user?.email ?? "Your account"}
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500">Member since {formatJoinDate(user?.created_at)}</p>
          </div>
          <div className="flex items-center gap-2 flex-none">
            <Link to="/profile" className={btnSecondary}>
              Manage account
            </Link>
            <button onClick={handleSignOut} className={btnSecondary}>
              Sign out
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className={`${cardBase} p-6 lg:col-span-2`}>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Appearance</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Applies across the whole app.</p>
            <div className="grid grid-cols-3 gap-3">
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTheme(opt.value)}
                  className={`rounded-lg border-2 p-2 text-sm transition-colors ${
                    theme === opt.value
                      ? "border-blue-600 dark:border-blue-500"
                      : "border-transparent hover:border-gray-200 dark:hover:border-gray-700"
                  }`}
                >
                  <ThemePreview mode={opt.value} />
                  <span
                    className={`block mt-2 font-medium ${
                      theme === opt.value
                        ? "text-blue-700 dark:text-blue-400"
                        : "text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    {opt.label}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
              Looking for accent colors, link styling, or spacing? Those are per-paper — open any paper's
              editor and expand its Appearance panel.
            </p>
          </div>

          <div className={`${cardBase} p-6`}>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Doc Buddy</h2>
            <div className="flex items-start gap-3">
              <span className="text-lg flex-none">💬</span>
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Chat</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Groq's <span className="font-mono">openai/gpt-oss-120b</span> — free, no API key required.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 mt-4">
              <span className="text-lg flex-none">🖼️</span>
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Image generation</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Right from the chat composer, via Pollinations.ai — free, no limits.
                </p>
              </div>
            </div>
          </div>

          <div className={`${cardBase} p-6 lg:col-span-3`}>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Data</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Remove every saved Doc Buddy conversation, including any images generated inside them. Your
              papers aren't affected.
            </p>
            <button
              onClick={handleClearConversations}
              disabled={clearing}
              className={`${btnDanger} dark:hover:bg-red-950/40`}
            >
              {clearing ? "Clearing…" : "Clear all conversations"}
            </button>
            {cleared && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">All conversations cleared.</p>
            )}
          </div>
        </div>
      </div>
      {ConfirmDialog}
    </div>
  );
}
