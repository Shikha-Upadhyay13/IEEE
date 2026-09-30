import { usePageMeta } from "../lib/usePageMeta";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Download, FileText, Loader2, Trash2 } from "lucide-react";
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

type ExportGroup = { key: string; title: string; documentId: string | null; rows: ExportRow[] };

// Collapses N one-off PDFs into "N exports of Paper X" instead of a long,
// undifferentiated list of thin rows — grouping is what actually makes a
// list of many small items feel organized rather than just long.
const COLLAPSED_ROW_LIMIT = 3;

export function DownloadsPage() {
  usePageMeta({ title: "Downloads", noindex: true });
  const navigate = useNavigate();
  const [exports, setExports] = useState<ExportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const { confirm, ConfirmDialog } = useConfirm();

  // exports is already sorted newest-first, so Map insertion order alone
  // gives "most recently exported paper first" for free, and each group's
  // own rows are already newest-first too.
  const groups = useMemo(() => {
    const map = new Map<string, ExportGroup>();
    for (const row of exports) {
      const key = row.document_id ?? "deleted";
      const group = map.get(key);
      if (group) group.rows.push(row);
      else map.set(key, { key, title: row.title, documentId: row.document_id, rows: [row] });
    }
    return Array.from(map.values());
  }, [exports]);

  function toggleGroupExpanded(key: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

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
    <div className="min-h-screen flex flex-col md:flex-row bg-canvas">
      <DashboardSidebar
        onSignOut={async () => {
          await supabase.auth.signOut();
          navigate("/login");
        }}
      />

      <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 px-4 py-6 sm:px-8 sm:py-10 focus:outline-none">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-display text-2xl font-semibold text-ink tracking-tight mb-1">Downloads</h1>
          <p className="text-sm text-muted mb-6">
            {exports.length > 0
              ? `${exports.length} export${exports.length === 1 ? "" : "s"} across ${groups.length} paper${groups.length === 1 ? "" : "s"} — export again from a paper's editor to add another.`
              : "Every PDF you've exported, kept in one place — export again from a paper's editor to add another."}
          </p>

          {loading ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : exports.length === 0 ? (
            <p className="text-sm text-muted">
              No exports yet — open a paper and export it to PDF.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {groups.map((group) => {
                const expanded = expandedGroups.has(group.key);
                const visibleRows = expanded ? group.rows : group.rows.slice(0, COLLAPSED_ROW_LIMIT);
                const hiddenCount = group.rows.length - visibleRows.length;
                return (
                  <div
                    key={group.key}
                    className="bg-surface rounded-xl border border-line shadow-sm overflow-hidden"
                  >
                    <div className="flex items-center gap-2.5 px-4 py-3 border-b border-line">
                      <FileText size={18} className="flex-none text-muted" aria-hidden="true" />
                      <p className="text-sm font-semibold text-ink truncate flex-1">
                        {group.title}
                      </p>
                      <span className="text-xs text-muted flex-none">
                        {group.rows.length} export{group.rows.length === 1 ? "" : "s"}
                      </span>
                      {group.documentId && (
                        <Link
                          to={`/editor/${group.documentId}`}
                          className="text-xs text-ink hover:text-ink hover:underline flex-none"
                        >
                          Open paper
                        </Link>
                      )}
                    </div>
                    <div className="divide-y divide-line">
                      {visibleRows.map((row) => (
                        <div key={row.id} className="flex items-center gap-3 px-4 py-2.5">
                          <p className="text-xs text-muted flex-1">
                            Exported {relativeTime(row.created_at)}
                          </p>
                          <button
                            onClick={() => handleDownload(row)}
                            disabled={downloadingId === row.id}
                            className={btnSecondary}
                          >
                            {downloadingId === row.id ? (
                              <Loader2 size={14} className="animate-spin" aria-label="Downloading" />
                            ) : (
                              <>
                                <Download size={14} aria-hidden="true" />
                                Download
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => handleDelete(row)}
                            aria-label="Delete download"
                            className="w-8 h-8 flex-none flex items-center justify-center rounded-md text-muted hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                          >
                            <Trash2 size={15} aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                    </div>
                    {hiddenCount > 0 ? (
                      <button
                        onClick={() => toggleGroupExpanded(group.key)}
                        className="w-full text-xs text-muted hover:text-ink py-2 border-t border-line transition-colors"
                      >
                        Show {hiddenCount} more
                      </button>
                    ) : (
                      expanded &&
                      group.rows.length > COLLAPSED_ROW_LIMIT && (
                        <button
                          onClick={() => toggleGroupExpanded(group.key)}
                          className="w-full text-xs text-muted hover:text-ink py-2 border-t border-line transition-colors"
                        >
                          Show fewer
                        </button>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
      {ConfirmDialog}
    </div>
  );
}
