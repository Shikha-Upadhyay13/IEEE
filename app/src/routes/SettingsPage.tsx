import { usePageMeta } from "../lib/usePageMeta";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Download, Image as ImageIcon, MessageSquare, Trash2 } from "lucide-react";
import { useAuth } from "../lib/useAuth";
import { useTheme, type ThemeSetting } from "../lib/useTheme";
import { supabase } from "../supabaseClient";
import { btnDanger, btnSecondary, cardBase, inputBase, labelBase, pageShell } from "../lib/uiClasses";
import { collectAccountData, deleteAccount, downloadJson, exportFilename } from "../lib/accountData";
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

export function SettingsPage() {
  usePageMeta({ title: "Settings", noindex: true });
  const { user } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [deleteText, setDeleteText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
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

  async function handleExportData() {
    setExporting(true);
    setExportError(null);
    try {
      downloadJson(await collectAccountData(), exportFilename());
    } catch (err) {
      console.error("Data export failed:", err);
      setExportError(err instanceof Error ? err.message : "Couldn't export your data.");
    } finally {
      setExporting(false);
    }
  }

  async function handleDeleteAccount() {
    if (deleteText !== "DELETE") return;
    const ok = await confirm({
      title: "Delete your account permanently?",
      message: "Everything on this account will be erased right now. There is no way to recover it.",
      confirmLabel: "Delete everything",
    });
    if (!ok) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount();
      navigate("/", { replace: true });
    } catch (err) {
      console.error("Account deletion failed:", err);
      setDeleteError(err instanceof Error ? err.message : "Couldn't delete your account.");
      setDeleting(false);
    }
  }

  return (
    <div className={`${pageShell} flex flex-col md:flex-row`}>
      <DashboardSidebar onSignOut={handleSignOut} />

      <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 px-4 py-6 sm:px-8 sm:py-10 focus:outline-none">
        <h1 className="font-display text-2xl font-semibold text-ink tracking-tight mb-1">Settings</h1>
        <p className="text-sm text-muted mb-6">
          Your account, appearance, and Doc Buddy preferences.
        </p>

        {/* Account summary banner — full width, real content (avatar, join
            date) instead of just a nav link to the Profile page, so this
            page doesn't feel like a mostly-empty shell around three small
            cards. */}
        <div className={`${cardBase} p-6 mb-6 flex flex-wrap items-center gap-4`}>
          <div className="w-14 h-14 rounded-full bg-accent text-accent-fg flex items-center justify-center text-xl font-semibold flex-none">
            {user?.email?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-ink truncate">
              {user?.email ?? "Your account"}
            </p>
            <p className="text-sm text-muted">Member since {formatJoinDate(user?.created_at)}</p>
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
            <h2 className="text-base font-semibold text-ink mb-1">Appearance</h2>
            <p className="text-sm text-muted mb-4">Applies across the whole app.</p>
            <div className="grid grid-cols-3 gap-3">
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTheme(opt.value)}
                  className={`rounded-lg border-2 p-2 text-sm transition-colors ${
                    theme === opt.value
                      ? "border-accent"
                      : "border-transparent hover:border-line"
                  }`}
                >
                  <ThemePreview mode={opt.value} />
                  <span
                    className={`block mt-2 font-medium ${
                      theme === opt.value
                        ? "text-accent"
                        : "text-muted"
                    }`}
                  >
                    {opt.label}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted mt-4">
              Looking for accent colors, link styling, or spacing? Those are per-paper — open any paper's
              editor and expand its Appearance panel.
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

          <div className={`${cardBase} p-6 lg:col-span-3`}>
            <h2 className="text-base font-semibold text-ink mb-1">Your data</h2>
            <h3 className="text-sm font-semibold text-ink mb-1">Clear conversations</h3>
            <p className="text-sm text-muted mb-4">
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
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2" role="status">All conversations cleared.</p>
            )}

            <div className="mt-6 border-t border-line pt-6">
              <h3 className="text-sm font-semibold text-ink mb-1">Download your data</h3>
              <p className="text-sm text-muted mb-3">
                One JSON file with every paper (including version history), project, conversation and export record
                on your account.
              </p>
              <button type="button" onClick={handleExportData} disabled={exporting} className={btnSecondary}>
                <Download size={15} aria-hidden="true" />
                {exporting ? "Preparing…" : "Download my data (JSON)"}
              </button>
              {exportError && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-2" role="alert">{exportError}</p>
              )}
            </div>

            <div className="mt-6 border-t border-line pt-6">
              <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-1">Delete account</h3>
              <p className="text-sm text-muted mb-3">
                Permanently deletes your account, papers, version history, conversations, uploaded figures and
                exported PDFs. This can't be undone — download your data first if you want a copy.
              </p>
              <label htmlFor="delete-confirm" className={`${labelBase} mb-1`}>
                Type <span className="font-mono font-semibold text-ink">DELETE</span> to confirm
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  id="delete-confirm"
                  value={deleteText}
                  onChange={(e) => setDeleteText(e.target.value)}
                  autoComplete="off"
                  className={`${inputBase} max-w-[12rem]`}
                />
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={deleteText !== "DELETE" || deleting}
                  className={`${btnDanger} dark:hover:bg-red-950/40`}
                >
                  <Trash2 size={15} aria-hidden="true" />
                  {deleting ? "Deleting…" : "Delete my account"}
                </button>
              </div>
              {deleteError && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-2" role="alert">{deleteError}</p>
              )}
            </div>
          </div>
        </div>
      </main>
      {ConfirmDialog}
    </div>
  );
}
