import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import { useTheme, type ThemeSetting } from "../lib/useTheme";
import { supabase } from "../supabaseClient";
import { btnDanger } from "../lib/uiClasses";

const THEME_OPTIONS: { value: ThemeSetting; label: string; icon: string }[] = [
  { value: "light", label: "Light", icon: "☀️" },
  { value: "dark", label: "Dark", icon: "🌙" },
  { value: "system", label: "System", icon: "🖥️" },
];

export function SettingsPage() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);

  async function handleClearConversations() {
    if (!user) return;
    if (!window.confirm("Delete all AI Assistant conversations? This can't be undone.")) return;
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
    <div className="min-h-screen bg-[#f7f6f3] dark:bg-gray-950">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <Link
          to="/dashboard"
          className="text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
        >
          ← Dashboard
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight mt-6 mb-6">Settings</h1>

        <div className="bg-white dark:bg-gray-900 dark:border-gray-800 rounded-xl border border-gray-200 shadow-sm p-6 mb-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Appearance</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Applies across the AI Assistant, Images, and account pages.
          </p>
          <div className="flex gap-2">
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={`flex-1 flex flex-col items-center gap-1 rounded-lg border px-3 py-3 text-sm transition-colors ${
                  theme === opt.value
                    ? "border-indigo-400 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
                    : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
              >
                <span className="text-lg">{opt.icon}</span>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 dark:border-gray-800 rounded-xl border border-gray-200 shadow-sm p-6 mb-4">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">AI Assistant</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Chat runs on Groq's <span className="font-mono text-xs">openai/gpt-oss-120b</span>, and image
            generation runs on Pollinations.ai — both free, no API key required from you.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 dark:border-gray-800 rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Data</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Remove every saved AI Assistant conversation. Your papers and generated images aren't affected.
          </p>
          <button
            onClick={handleClearConversations}
            disabled={clearing}
            className={`${btnDanger} dark:hover:bg-red-950/40`}
          >
            {clearing ? "Clearing…" : "Clear all conversations"}
          </button>
          {cleared && <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">All conversations cleared.</p>}
        </div>
      </div>
    </div>
  );
}
