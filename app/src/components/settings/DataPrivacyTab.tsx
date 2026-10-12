import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Trash2 } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { btnDanger, btnSecondary, cardBase, inputBase, labelBase } from "../../lib/uiClasses";
import { collectAccountData, deleteAccount, downloadJson, exportFilename } from "../../lib/accountData";
import { useConfirm } from "../ConfirmDialog";

export function DataPrivacyTab({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [deleteText, setDeleteText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { confirm, ConfirmDialog } = useConfirm();

  async function handleClearConversations() {
    const ok = await confirm({
      title: "Clear all conversations?",
      message: "Delete all Doc Buddy conversations? This can't be undone.",
      confirmLabel: "Clear all",
    });
    if (!ok) return;
    setClearing(true);
    setCleared(false);
    const { error } = await supabase.from("conversations").delete().eq("owner_id", userId);
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
    <div className={`${cardBase} p-6`}>
      <h2 className="text-base font-semibold text-ink mb-1">Your data</h2>
      <h3 className="text-sm font-semibold text-ink mb-1">Clear conversations</h3>
      <p className="text-sm text-muted mb-4">
        Remove every saved Doc Buddy conversation, including any images generated inside them. Your papers aren't
        affected.
      </p>
      <button onClick={handleClearConversations} disabled={clearing} className={`${btnDanger} dark:hover:bg-red-950/40`}>
        {clearing ? "Clearing…" : "Clear all conversations"}
      </button>
      {cleared && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2" role="status">
          All conversations cleared.
        </p>
      )}

      <div className="mt-6 border-t border-line pt-6">
        <h3 className="text-sm font-semibold text-ink mb-1">Download your data</h3>
        <p className="text-sm text-muted mb-3">
          One JSON file with every paper (including version history), project, conversation and export record on your
          account.
        </p>
        <button type="button" onClick={handleExportData} disabled={exporting} className={btnSecondary}>
          <Download size={15} aria-hidden="true" />
          {exporting ? "Preparing…" : "Download my data (JSON)"}
        </button>
        {exportError && (
          <p className="text-xs text-red-600 dark:text-red-400 mt-2" role="alert">
            {exportError}
          </p>
        )}
      </div>

      <div className="mt-6 border-t border-line pt-6">
        <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-1">Delete account</h3>
        <p className="text-sm text-muted mb-3">
          Permanently deletes your account, papers, version history, conversations, uploaded figures and exported PDFs.
          This can't be undone — download your data first if you want a copy.
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
          <p className="text-xs text-red-600 dark:text-red-400 mt-2" role="alert">
            {deleteError}
          </p>
        )}
      </div>
      {ConfirmDialog}
    </div>
  );
}
