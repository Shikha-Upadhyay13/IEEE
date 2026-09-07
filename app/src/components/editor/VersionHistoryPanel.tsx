import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import { relativeTime } from "../../lib/relativeTime";
import { btnPrimary, btnSecondary, inputBase } from "../../lib/uiClasses";
import type { Document } from "../../types/document";

export interface VersionHistoryItem {
  id: string;
  document_id: string;
  title: string | null;
  content: Document;
  created_at: string;
}

interface VersionHistoryPanelProps {
  documentId: string;
  currentDocument: Document;
  isOpen: boolean;
  onClose: () => void;
  onRestore: (restored: Document) => void;
}

export function VersionHistoryPanel({
  documentId,
  currentDocument,
  isOpen,
  onClose,
  onRestore,
}: VersionHistoryPanelProps) {
  const [versions, setVersions] = useState<VersionHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [snapshotLabel, setSnapshotLabel] = useState("");
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !documentId) return;
    let cancelled = false;

    async function fetchVersions() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("document_versions")
          .select("id, document_id, title, content, created_at")
          .eq("document_id", documentId)
          .order("created_at", { ascending: false });

        if (!cancelled) {
          if (!error && data) {
            setVersions(data as VersionHistoryItem[]);
          }
        }
      } catch (err) {
        console.warn("Failed to load document versions:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchVersions();
    return () => {
      cancelled = true;
    };
  }, [isOpen, documentId]);

  if (!isOpen) return null;

  async function handleCreateSnapshot() {
    setCreating(true);
    const label = snapshotLabel.trim() || `Snapshot ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    try {
      const { data, error } = await supabase
        .from("document_versions")
        .insert({
          document_id: documentId,
          title: label,
          content: currentDocument,
        })
        .select()
        .single();

      if (!error && data) {
        setVersions((prev) => [data as VersionHistoryItem, ...prev]);
        setSnapshotLabel("");
      }
    } catch (err) {
      console.error("Failed to create snapshot:", err);
    } finally {
      setCreating(false);
    }
  }

  function handleRestore(version: VersionHistoryItem) {
    if (window.confirm(`Restore "${version.title || 'snapshot'}"? Your current editor state will be replaced with this version.`)) {
      setRestoringId(version.id);
      onRestore(version.content);
      setTimeout(() => {
        setRestoringId(null);
        onClose();
      }, 300);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <span className="text-lg">🕒</span>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Version History</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Snapshot Creation Form */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Save a snapshot now
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={snapshotLabel}
              onChange={(e) => setSnapshotLabel(e.target.value)}
              placeholder="e.g. Before conference submission"
              className={`${inputBase} text-xs py-1.5`}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateSnapshot();
              }}
            />
            <button
              type="button"
              onClick={handleCreateSnapshot}
              disabled={creating}
              className={`${btnPrimary} text-xs py-1.5 px-3 flex-none`}
            >
              {creating ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        {/* Version List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <p className="text-xs text-center text-gray-400 dark:text-gray-500 py-8">Loading history…</p>
          ) : versions.length === 0 ? (
            <div className="text-center py-10 px-4">
              <span className="text-3xl block mb-2 opacity-50">📑</span>
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300">No snapshots saved yet</p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                Save a snapshot above anytime to bookmark your progress, or let auto-snapshots keep your revisions safe.
              </p>
            </div>
          ) : (
            versions.map((ver) => {
              const date = new Date(ver.created_at);
              const formattedDate = date.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              });
              const formattedTime = date.toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              });
              const sectionsCount = ver.content.body?.length ?? 0;

              return (
                <div
                  key={ver.id}
                  className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-850 hover:border-gray-300 dark:hover:border-gray-700 transition-colors shadow-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                        {ver.title || "Untitled snapshot"}
                      </h4>
                      <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                        <span>{formattedDate} at {formattedTime}</span>
                        <span>•</span>
                        <span>{relativeTime(ver.created_at)}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRestore(ver)}
                      disabled={restoringId === ver.id}
                      className={`${btnSecondary} text-[11px] py-1 px-2.5 flex-none`}
                    >
                      {restoringId === ver.id ? "Restoring…" : "Restore"}
                    </button>
                  </div>
                  <div className="mt-2 text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-3">
                    <span>{sectionsCount} {sectionsCount === 1 ? "section" : "sections"}</span>
                    <span>•</span>
                    <span>{ver.content.references?.length ?? 0} citations</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
