import { Image as ImageIcon, MessageSquare } from "lucide-react";
import { useTheme, type ThemeSetting } from "../../lib/useTheme";
import { cardBase } from "../../lib/uiClasses";

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
      <div className="w-full h-16 rounded-md overflow-hidden border border-line flex">
        <div className="w-1/2 bg-canvas flex flex-col gap-1.5 p-2">
          <div className="h-1.5 w-full rounded-full bg-line" />
          <div className="h-1.5 w-2/3 rounded-full bg-line" />
        </div>
        <div className="w-1/2 bg-[#12100e] flex flex-col gap-1.5 p-2">
          <div className="h-1.5 w-full rounded-full bg-[#322e28]" />
          <div className="h-1.5 w-2/3 rounded-full bg-[#322e28]" />
        </div>
      </div>
    );
  }
  const isDark = mode === "dark";
  return (
    <div
      className={`w-full h-16 rounded-md overflow-hidden border flex flex-col gap-1.5 p-2 ${
        isDark ? "border-[#322e28] bg-[#12100e]" : "border-line bg-surface"
      }`}
    >
      <div className={`h-1.5 w-full rounded-full ${isDark ? "bg-[#322e28]" : "bg-line"}`} />
      <div className={`h-1.5 w-2/3 rounded-full ${isDark ? "bg-[#322e28]" : "bg-line"}`} />
      <div className={`h-1.5 w-1/2 rounded-full ${isDark ? "bg-[#322e28]" : "bg-line"}`} />
    </div>
  );
}

export function PreferencesTab() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className={`${cardBase} p-6 lg:col-span-2`}>
        <h2 className="text-base font-semibold text-ink mb-1">Appearance</h2>
        <p className="text-sm text-muted mb-4">Applies across the whole app.</p>
        <div className="grid grid-cols-3 gap-3">
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              aria-pressed={theme === opt.value}
              className={`rounded-lg border-2 p-2 text-sm transition-colors ${
                theme === opt.value ? "border-accent" : "border-transparent hover:border-line"
              }`}
            >
              <ThemePreview mode={opt.value} />
              <span className={`block mt-2 font-medium ${theme === opt.value ? "text-accent" : "text-muted"}`}>
                {opt.label}
              </span>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted mt-4">
          Looking for accent colors, link styling, or spacing? Those are per-paper — open any paper's editor and expand
          its Appearance panel.
        </p>
      </div>

      <div className={`${cardBase} p-6`}>
        <h2 className="text-base font-semibold text-ink mb-4">Doc Buddy</h2>
        <div className="flex items-start gap-3">
          <MessageSquare size={18} className="flex-none mt-0.5 text-accent" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-ink">Chat</p>
            <p className="text-xs text-muted leading-relaxed">
              Groq's <span className="font-mono">openai/gpt-oss-120b</span> — free, no API key required.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 mt-4">
          <ImageIcon size={18} className="flex-none mt-0.5 text-accent" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-ink">Image generation</p>
            <p className="text-xs text-muted leading-relaxed">
              Right from the chat composer, via Pollinations.ai — free, no limits.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
