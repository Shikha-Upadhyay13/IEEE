import { useState } from "react";
import { supabase } from "../../supabaseClient";
import { btnPrimary } from "../../lib/uiClasses";

const PDF_SERVICE_URL = import.meta.env.VITE_PDF_SERVICE_URL ?? "http://localhost:3001";

// Best-effort: a failure here shouldn't undo the export the user already
// got (the browser download already happened by the time this runs) — it
// only means this copy won't show up on the Downloads page later.
async function persistExportCopy(documentId: string, title: string, blob: Blob) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const path = `${user.id}/${documentId}/${generateFileTimestamp()}.pdf`;
  const { error: uploadError } = await supabase.storage.from("exports").upload(path, blob, {
    contentType: "application/pdf",
  });
  if (uploadError) {
    console.error("Failed to save export copy:", uploadError);
    return;
  }
  const { error: insertError } = await supabase
    .from("exports")
    .insert({ owner_id: user.id, document_id: documentId, title, storage_path: path });
  if (insertError) console.error("Failed to record export:", insertError);
}

// A storage path segment, not a display timestamp — doesn't need to be
// human-readable, just unique-enough per user per document.
function generateFileTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

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
      // Mint a short-lived token scoped to this document while we still have
      // the user's authenticated session — the pdf-service itself has none
      // (it's a headless script), so it can't call this RPC itself. See
      // ARCHITECTURE.md §5.3 and supabase/schema.sql.
      const { data: token, error: tokenError } = await supabase.rpc("create_export_token", {
        doc_id: documentId,
      });
      if (tokenError || !token) throw tokenError ?? new Error("No token returned");

      const response = await fetch(`${PDF_SERVICE_URL}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, token }),
      });
      if (!response.ok) throw new Error(`Export failed: ${response.status}`);

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "paper.pdf";
      a.click();
      URL.revokeObjectURL(url);
      setStatus("idle");

      persistExportCopy(documentId, title, blob);
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
        {status === "error" && <p className="text-xs text-red-600 mt-1">Export failed</p>}
      </div>
    );
  }

  return (
    <div className="p-4 border-t border-gray-100">
      <button onClick={handleExport} disabled={status === "exporting"} className={`${btnPrimary} w-full`}>
        {status === "exporting" ? "Exporting…" : "Export PDF"}
      </button>
      {status === "error" && (
        <p className="text-xs text-red-600 mt-1.5">Export failed — is pdf-service running?</p>
      )}
    </div>
  );
}
