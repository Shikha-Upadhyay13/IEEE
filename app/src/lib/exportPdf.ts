import { supabase } from "../supabaseClient";

const PDF_SERVICE_URL = import.meta.env.VITE_PDF_SERVICE_URL ?? "http://localhost:3001";

// A storage path segment, not a display timestamp — doesn't need to be
// human-readable, just unique-enough per user per document.
function generateFileTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

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

// Shared by ExportButton (the editor's own button) and the command
// palette's "Export PDF" action — one place for "mint a token, call
// pdf-service, trigger the browser download, persist a copy for Downloads".
export async function exportDocumentPdf(documentId: string, title: string): Promise<void> {
  // Mint a short-lived token scoped to this document while we still have the
  // user's authenticated session — the pdf-service itself has none (it's a
  // headless script), so it can't call this RPC itself. See
  // ARCHITECTURE.md §5.3 and supabase/schema.sql.
  const { data: token, error: tokenError } = await supabase.rpc("create_export_token", { doc_id: documentId });
  if (tokenError || !token) throw tokenError ?? new Error("No token returned");

  const response = await fetch(`${PDF_SERVICE_URL}/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documentId, token }),
  });
  if (!response.ok) throw new Error(`Export failed: ${response.status}`);

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = window.document.createElement("a");
  a.href = url;
  a.download = "paper.pdf";
  a.click();
  URL.revokeObjectURL(url);

  persistExportCopy(documentId, title, blob);
}
