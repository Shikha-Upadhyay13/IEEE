import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { relativeTime } from "../lib/relativeTime";
import { DashboardSidebar } from "../components/dashboard/DashboardSidebar";
import { useConfirm } from "../components/ConfirmDialog";
import { btnSecondary } from "../lib/uiClasses";

type ExportRow = {
  id: string;
  title: string;
  document_id: string | null;
  storage_path: string;
  created_at: string;
};

export function DownloadsPage() {
  const navigate = useNavigate();
  const [exports, setExports] = useState<ExportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const { confirm, ConfirmDialog } = useConfirm();

  useEffect(() => {
    supabase
      .from("exports")
      .select("id, title, document_id, storage_path, created_at")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error("Failed to load exports:", error);
        setExports(data ?? []);
        setLoading(false);
      });
  }, []);

  async function handleDownload(row: ExportRow) {
    setDownloadingId(row.id);
    try {
      // Short-lived signed URL, not a permanent one — the bucket is private
      // (see supabase/schema.sql), matching the export_tokens pattern used
      // for the PDF service's own headless print-route access.
      const { data, error } = await supabase.storage.from("exports").createSignedUrl(row.storage_path, 60);
      if (error || !data) throw error ?? new Error("Could not create a download link");

      const response = await fetch(data.signedUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = `${row.title.replace(/[^a-z0-9]+/gi, "-") || "paper"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleDelete(row: ExportRow) {
    const ok = await confirm({
      title: "Delete this download?",
      message: `Remove "${row.title}" from your downloads? This can't be undone.`,
      confirmLabel: "Delete",
    });
    if (!ok) return;

    const previous = exports;
    setExports((prev) => prev.filter((e) => e.id !== row.id));
    const [{ error: storageError }, { error: dbError }] = await Promise.all([
      supabase.storage.from("exports").remove([row.storage_path]),
      supabase.from("exports").delete().eq("id", row.id),
    ]);
    if (storageError || dbError) {
      console.error("Failed to delete export:", storageError ?? dbError);
      setExports(previous);
    }
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
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight mb-1">Downloads</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Every PDF you've exported, kept in one place — export again from a paper's editor to add another.
          </p>

          {loading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
          ) : exports.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">
              No exports yet — open a paper and export it to PDF.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {exports.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center gap-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm px-4 py-3"
                >
                  <span className="text-xl flex-none">📄</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{row.title}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      Exported {relativeTime(row.created_at)}
                      {row.document_id && (
                        <>
                          {" · "}
                          <Link
                            to={`/editor/${row.document_id}`}
                            className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:underline"
                          >
                            Open paper
                          </Link>
                        </>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDownload(row)}
                    disabled={downloadingId === row.id}
                    className={btnSecondary}
                  >
                    {downloadingId === row.id ? "…" : "⬇ Download"}
                  </button>
                  <button
                    onClick={() => handleDelete(row)}
                    aria-label="Delete download"
                    className="w-8 h-8 flex-none flex items-center justify-center rounded-md text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {ConfirmDialog}
    </div>
  );
}
