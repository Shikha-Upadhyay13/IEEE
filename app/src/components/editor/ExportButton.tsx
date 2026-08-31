import { useState } from "react";
import { btnPrimary } from "../../lib/uiClasses";
import { exportDocumentPdf } from "../../lib/exportPdf";

export function ExportButton({
  documentId,
  title,
  compact = false,
}: {
  documentId: string;
  title: string;
  /** Renders as an inline button with no wrapping border/padding — used in
   *  the editor's top bar, where the sidebar's stacked full-width treatment
   *  below would look out of place. */
  compact?: boolean;
}) {
  const [status, setStatus] = useState<"idle" | "exporting" | "error">("idle");

  async function handleExport() {
    setStatus("exporting");
    try {
      await exportDocumentPdf(documentId, title);
      setStatus("idle");
    } catch (err) {
      console.error("Export failed:", err);
      setStatus("error");
    }
  }

  if (compact) {
    return (
      <div className="flex flex-col items-end">
        <button onClick={handleExport} disabled={status === "exporting"} className={`${btnPrimary} px-4 py-2`}>
          {status === "exporting" ? "Exporting…" : "⬇ Download PDF"}
        </button>
        {status === "error" && <p className="text-xs text-red-600 dark:text-red-400 mt-1">Export failed</p>}
      </div>
    );
  }

  return (
    <div className="p-4 border-t border-gray-100 dark:border-gray-800">
      <button onClick={handleExport} disabled={status === "exporting"} className={`${btnPrimary} w-full`}>
        {status === "exporting" ? "Exporting…" : "Export PDF"}
      </button>
      {status === "error" && (
        <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">Export failed — is pdf-service running?</p>
      )}
    </div>
  );
}
