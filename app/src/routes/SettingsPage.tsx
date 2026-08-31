import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import { useTheme, type ThemeSetting } from "../lib/useTheme";
import { supabase } from "../supabaseClient";
import { btnDanger, cardBase } from "../lib/uiClasses";
import { useConfirm } from "../components/ConfirmDialog";
import { DashboardSidebar } from "../components/dashboard/DashboardSidebar";

const THEME_OPTIONS: { value: ThemeSetting; label: string; icon: string }[] = [
  { value: "light", label: "Light", icon: "☀️" },
  { value: "dark", label: "Dark", icon: "🌙" },
  { value: "system", label: "System", icon: "🖥️" },
];

type SectionId = "appearance" | "assistant" | "data";

const SECTIONS: { id: SectionId; label: string; icon: string }[] = [
  { id: "appearance", label: "Appearance", icon: "🎨" },
  { id: "assistant", label: "AI Assistant", icon: "✨" },
  { id: "data", label: "Data", icon: "🗄️" },
];

export function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [section, setSection] = useState<SectionId>("appearance");
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm();

  async function handleClearConversations() {
    if (!user) return;
    const ok = await confirm({
      title: "Clear all conversations?",
      message: "Delete all AI Assistant conversations? This can't be undone.",
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
    <div className="min-h-screen flex bg-[#f7f6f3] dark:bg-gray-950">
      <DashboardSidebar
        onSignOut={async () => {
          await supabase.auth.signOut();
          navigate("/login");
        }}
      />

      <div className="flex-1 min-w-0 px-8 py-10">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight mb-6">Settings</h1>

          {/* A left-nav-plus-content layout instead of every section stacked
              vertically — one section visible at a time keeps the page a
              fixed, predictable height instead of growing with every new
              setting this page ever gains. */}
          <div className="grid grid-cols-[200px_1fr] gap-8 items-start">
            <nav className="flex flex-col gap-1">
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSection(s.id)}
                  className={`flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-sm text-left transition-colors ${
                    section === s.id
                      ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-medium"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                >
                  <span>{s.icon}</span> {s.label}
                </button>
              ))}
            </nav>

            <div className={`${cardBase} p-8 min-h-[360px]`}>
              {section === "appearance" && (
                <div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Appearance</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Applies across the whole app.</p>
                  <div className="flex gap-2">
                    {THEME_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setTheme(opt.value)}
                        className={`flex-1 flex flex-col items-center gap-1 rounded-lg border px-3 py-3 text-sm transition-colors ${
                          theme === opt.value
                            ? "border-gray-400 dark:border-gray-500 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium"
                            : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
                        }`}
                      >
                        <span className="text-lg">{opt.icon}</span>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
                    Looking for accent colors, link styling, or spacing? Those are per-paper — open any paper's
                    editor and expand its Appearance panel.
                  </p>
                </div>
              )}

              {section === "assistant" && (
                <div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">AI Assistant</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Chat runs on Groq's <span className="font-mono text-xs">openai/gpt-oss-120b</span>, and image
                    generation (right from the chat composer) runs on Pollinations.ai — both free, no API key
                    required from you.
                  </p>
                </div>
              )}

              {section === "data" && (
                <div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Data</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Remove every saved AI Assistant conversation, including any images generated inside them.
                    Your papers aren't affected.
                  </p>
                  <button
                    onClick={handleClearConversations}
                    disabled={clearing}
                    className={`${btnDanger} dark:hover:bg-red-950/40`}
                  >
                    {clearing ? "Clearing…" : "Clear all conversations"}
                  </button>
                  {cleared && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">
                      All conversations cleared.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {ConfirmDialog}
    </div>
  );
}
