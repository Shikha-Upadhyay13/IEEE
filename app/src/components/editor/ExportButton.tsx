import { useEffect, useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { btnPrimary } from "../../lib/uiClasses";
import { EXPORT_PDF_EVENT, exportDocumentPdf } from "../../lib/exportPdf";

export function ExportButton({
  documentId,
  title,
  blockers = 0,
  compact = false,
}: {
  documentId: string;
  title: string;
  /** Checklist blockers that stop a Submission-mode export; 0 when exporting is allowed. */
  blockers?: number;
  /** Renders as an inline button with no wrapping border/padding — used in
   *  the editor's top bar, where the sidebar's stacked full-width treatment
   *  below would look out of place. */
  compact?: boolean;
}) {
  const [status, setStatus] = useState<"idle" | "exporting" | "error" | "blocked">("idle");

  async function handleExport() {
    if (blockers > 0) {
      setStatus("blocked");
      return;
    }
    setStatus("exporting");
    try {
      await exportDocumentPdf(documentId, title);
      setStatus("idle");
    } catch (err) {
      console.error("Export failed:", err);
      setStatus("error");
    }
  }

  const exportRef = useRef(handleExport);
  exportRef.current = handleExport;
  useEffect(() => {
    const onRequest = () => void exportRef.current();
    window.addEventListener(EXPORT_PDF_EVENT, onRequest);
    return () => window.removeEventListener(EXPORT_PDF_EVENT, onRequest);
  }, []);

  useEffect(() => {
    if (blockers === 0) setStatus((s) => (s === "blocked" ? "idle" : s));
  }, [blockers]);

  const blockedMessage = `Fix ${blockers} ${blockers === 1 ? "blocker" : "blockers"} in the Checklist first, or switch to Draft mode for a review copy.`;

  if (compact) {
    return (
      <div className="relative flex flex-col items-end">
        <button onClick={handleExport} disabled={status === "exporting"} className={`${btnPrimary} px-4 py-2`}>
          {status === "exporting" ? (
            <>
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              Exporting…
            </>
          ) : (
            <>
              <Download size={14} aria-hidden="true" />
              Download PDF
            </>
          )}
        </button>
        {status === "error" && <p className="text-xs text-red-600 dark:text-red-400 mt-1">Export failed</p>}
        {status === "blocked" && (
          <p
            role="alert"
            className="absolute top-full right-0 mt-1 w-64 rounded-md border border-line bg-surface p-2 text-xs text-red-600 shadow-lg dark:text-red-400"
          >
            {blockedMessage}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 border-t border-line">
      <button onClick={handleExport} disabled={status === "exporting"} className={`${btnPrimary} w-full`}>
        {status === "exporting" ? "Exporting…" : "Export PDF"}
      </button>
      {status === "error" && (
        <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">Export failed — is pdf-service running?</p>
      )}
      {status === "blocked" && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400 mt-1.5">
          {blockedMessage}
        </p>
      )}
    </div>
  );
}
