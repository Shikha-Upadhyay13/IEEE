import { useState } from "react";
import { supabase } from "../../supabaseClient";
import { btnPrimary } from "../../lib/uiClasses";

const PDF_SERVICE_URL = import.meta.env.VITE_PDF_SERVICE_URL ?? "http://localhost:3001";

export function ExportButton({ documentId }: { documentId: string }) {
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
    } catch (err) {
      console.error("Export failed:", err);
      setStatus("error");
    }
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
