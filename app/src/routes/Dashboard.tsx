import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { useAuth } from "../lib/useAuth";
import { createBlankDocument } from "../lib/blankDocument";
import { relativeTime } from "../lib/relativeTime";
import { inputBase } from "../lib/uiClasses";
import { DashboardSidebar } from "../components/dashboard/DashboardSidebar";
import { PaperThumbnail } from "../components/dashboard/PaperThumbnail";
import { useConfirm } from "../components/ConfirmDialog";

type DocumentRow = { id: string; title: string | null; updated_at: string };
type SortOrder = "updated" | "title";

const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: "updated", label: "Last edited" },
  { value: "title", label: "Title (A–Z)" },
];

function CardMenu({ onDuplicate, onDelete }: { onDuplicate: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    window.document.addEventListener("mousedown", handleClickOutside);
    return () => window.document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative flex-none">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label="More actions"
        className="w-7 h-7 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 flex items-center justify-center transition-colors"
      >
        ⋮
      </button>
      {open && (
        <div className="absolute right-0 bottom-full mb-1 w-36 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg py-1 z-10 text-sm">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
              setOpen(false);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
          >
            ⎘ Duplicate
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
              setOpen(false);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400"
          >
            ✕ Delete
          </button>
        </div>
      )}
    </div>
  );
}

function NewPaperCard({ creating, onClick }: { creating: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={creating}
      className="aspect-[8.5/11] w-full rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center gap-2 text-gray-400 dark:text-gray-500 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-700 dark:hover:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors"
    >
      <span className="text-3xl leading-none">+</span>
      <span className="text-sm font-medium">{creating ? "Creating…" : "New paper"}</span>
    </button>
  );
}

function PaperCard({
  doc,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
}: {
  doc: DocumentRow;
  onOpen: () => void;
  onRename: (title: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(doc.title || "Untitled paper");

  function commitRename() {
    setEditing(false);
    const trimmed = draftTitle.trim();
    if (trimmed && trimmed !== doc.title) onRename(trimmed);
    else setDraftTitle(doc.title || "Untitled paper");
  }

  return (
    <div className="flex flex-col">
      <button
        onClick={onOpen}
        className="group relative aspect-[8.5/11] w-full rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all overflow-hidden bg-white dark:bg-gray-900"
      >
        <PaperThumbnail documentId={doc.id} />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/35 transition-colors flex items-center justify-center">
          <span className="text-white text-xs font-semibold bg-black/50 px-3 py-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
            View paper
          </span>
        </div>
      </button>

      <div className="flex items-start justify-between gap-1 mt-2 px-0.5">
        <div className="min-w-0">
          {editing ? (
            <input
              autoFocus
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") {
                  setDraftTitle(doc.title || "Untitled paper");
                  setEditing(false);
                }
              }}
              className="w-full text-sm font-medium text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-900 border border-blue-400 dark:border-blue-500 rounded px-1.5 py-0.5 -mx-1.5 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="text-sm font-medium text-gray-800 dark:text-gray-100 hover:text-blue-700 dark:hover:text-blue-400 text-left truncate block w-full"
              title={`${doc.title || "Untitled paper"} (click to rename)`}
            >
              {doc.title || "Untitled paper"}
            </button>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">edited {relativeTime(doc.updated_at)}</p>
        </div>
        <CardMenu onDuplicate={onDuplicate} onDelete={onDelete} />
      </div>
    </div>
  );
}

export function Dashboard() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOrder>("updated");
  const navigate = useNavigate();
  const { confirm, ConfirmDialog } = useConfirm();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data, error } = await supabase
        .from("documents")
        .select("id, title, updated_at")
        .order("updated_at", { ascending: false });
      if (!cancelled) {
        if (error) console.error("Failed to load documents:", error);
        setDocuments(data ?? []);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredDocuments = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? documents.filter((d) => (d.title || "Untitled paper").toLowerCase().includes(q))
      : documents;
    if (sortBy === "title") {
      // documents is already sorted by updated_at from the query — .toSorted
      // keeps that as the stable tiebreaker for equal titles instead of
      // mutating the loaded array in place.
      return filtered.toSorted((a, b) =>
        (a.title || "Untitled paper").localeCompare(b.title || "Untitled paper")
      );
    }
    return filtered;
  }, [documents, search, sortBy]);

  async function handleCreate() {
    if (!user) return;
    setCreating(true);
    const blank = createBlankDocument();
    const { data, error } = await supabase
      .from("documents")
      .insert({ owner_id: user.id, title: "Untitled paper", content: blank })
      .select("id")
      .single();
    setCreating(false);
    if (error) {
      console.error("Failed to create document:", error);
      return;
    }
    navigate(`/editor/${data.id}`);
  }

  async function handleRename(id: string, title: string) {
    setDocuments((docs) => docs.map((d) => (d.id === id ? { ...d, title } : d)));
    const { error } = await supabase.from("documents").update({ title }).eq("id", id);
    if (error) console.error("Failed to rename document:", error);
  }

  async function handleDuplicate(id: string, title: string | null) {
    if (!user) return;
    setDuplicatingId(id);
    try {
      const { data: original, error: fetchError } = await supabase
        .from("documents")
        .select("content")
        .eq("id", id)
        .single();
      if (fetchError || !original) throw fetchError ?? new Error("Original paper not found");

      const newTitle = `${title || "Untitled paper"} (copy)`;
      const { data: copy, error: insertError } = await supabase
        .from("documents")
        .insert({ owner_id: user.id, title: newTitle, content: original.content })
        .select("id, title, updated_at")
        .single();
      if (insertError || !copy) throw insertError ?? new Error("Duplicate failed");

      setDocuments((docs) => [copy, ...docs]);
    } catch (err) {
      console.error("Failed to duplicate document:", err);
    } finally {
      setDuplicatingId(null);
    }
  }

  async function handleDelete(id: string, title: string | null) {
    const ok = await confirm({
      title: "Delete this paper?",
      message: `Delete "${title || "Untitled paper"}"? This can't be undone.`,
      confirmLabel: "Delete",
    });
    if (!ok) return;
    const previous = documents;
    setDocuments((docs) => docs.filter((d) => d.id !== id)); // optimistic
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) {
      console.error("Failed to delete document:", error);
      setDocuments(previous); // roll back
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    // Explicit navigation rather than relying on RequireAuth's reactive
    // redirect — deterministic regardless of any auth-listener timing.
    navigate("/login");
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#f7f6f3] dark:bg-gray-950">
      <DashboardSidebar onSignOut={handleSignOut} />

      <div className="flex-1 min-w-0 px-4 py-6 sm:px-8 sm:py-10">
        <div className="max-w-5xl mx-auto">
          <div className="flex justify-between items-end mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">My Papers</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Your first paper is free forever.</p>
            </div>
          </div>

          {!loading && documents.length > 0 && (
            <div className="flex items-center gap-3 mb-6">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search your papers…"
                className={`${inputBase} max-w-xs`}
              />
              <select
                aria-label="Sort papers"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOrder)}
                className={`${inputBase} w-auto cursor-pointer`}
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {loading ? (
            // Skeleton grid shaped like the real card layout, not a bare
            // "Loading…" line — the sidebar/header are already rendered by
            // this point, so a full-page spinner would be a step backwards.
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <div className="aspect-[8.5/11] w-full rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse" />
                  <div className="h-3.5 w-2/3 rounded bg-gray-200 dark:bg-gray-800 animate-pulse" />
                </div>
              ))}
            </div>
          ) : filteredDocuments.length === 0 && search ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">No papers match "{search}".</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
              <NewPaperCard creating={creating} onClick={handleCreate} />
              {filteredDocuments.map((doc) => (
                <PaperCard
                  key={doc.id}
                  doc={doc}
                  onOpen={() => navigate(`/editor/${doc.id}`)}
                  onRename={(title) => handleRename(doc.id, title)}
                  onDuplicate={() => handleDuplicate(doc.id, doc.title)}
                  onDelete={() => handleDelete(doc.id, doc.title)}
                />
              ))}
            </div>
          )}
          {duplicatingId && <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">Duplicating…</p>}
        </div>
      </div>
      {ConfirmDialog}
    </div>
  );
}
