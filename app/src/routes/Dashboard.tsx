import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { useAuth } from "../lib/useAuth";
import { createBlankDocument } from "../lib/blankDocument";
import { relativeTime } from "../lib/relativeTime";
import { btnPrimary, btnSecondary, inputBase } from "../lib/uiClasses";

type DocumentRow = { id: string; title: string | null; updated_at: string };

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
    <div className="group relative bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all overflow-hidden">
      <button
        onClick={onOpen}
        className="w-full text-left"
        // Clicking the mini-preview/title area opens the paper; the rename
        // input and action buttons below stop propagation so they don't.
      >
        <div className="h-28 bg-gradient-to-br from-indigo-50 to-gray-50 flex items-center justify-center border-b border-gray-100">
          <div className="w-14 h-[72px] bg-white rounded-sm shadow-sm border border-gray-200 flex flex-col gap-1 p-2">
            <div className="h-1.5 w-8 bg-gray-300 rounded-full mx-auto" />
            <div className="h-1 w-full bg-gray-200 rounded-full mt-1" />
            <div className="h-1 w-full bg-gray-200 rounded-full" />
            <div className="h-1 w-3/4 bg-gray-200 rounded-full" />
            <div className="h-1 w-full bg-gray-200 rounded-full mt-1" />
            <div className="h-1 w-full bg-gray-200 rounded-full" />
          </div>
        </div>
      </button>

      <div className="p-4">
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
            onClick={(e) => e.stopPropagation()}
            className="w-full text-sm font-medium text-gray-800 border border-indigo-300 rounded px-1.5 py-0.5 -mx-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditing(true);
            }}
            className="text-sm font-medium text-gray-800 hover:text-indigo-600 text-left truncate block w-full"
            // The full title (not a generic instruction) — otherwise a
            // truncated title had no way to be read in full at all.
            title={`${doc.title || "Untitled paper"} (click to rename)`}
          >
            {doc.title || "Untitled paper"}
          </button>
        )}
        <p className="text-xs text-gray-400 mt-1">Edited {relativeTime(doc.updated_at)}</p>
      </div>

      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
          aria-label="Duplicate paper"
          title="Duplicate"
          className="w-7 h-7 rounded-md bg-white/90 border border-gray-200 text-gray-400 hover:text-indigo-600 hover:border-indigo-200 transition-all flex items-center justify-center text-xs"
        >
          ⎘
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label="Delete paper"
          title="Delete"
          className="w-7 h-7 rounded-md bg-white/90 border border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-200 transition-all flex items-center justify-center text-sm"
        >
          ✕
        </button>
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
  const navigate = useNavigate();

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
    if (!q) return documents;
    return documents.filter((d) => (d.title || "Untitled paper").toLowerCase().includes(q));
  }, [documents, search]);

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
    if (!window.confirm(`Delete "${title || "Untitled paper"}"? This can't be undone.`)) return;
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
  }

  return (
    <div className="min-h-screen bg-[#f7f6f3]">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Your papers</h1>
            <p className="text-sm text-gray-500">IEEE Paper Builder</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleCreate} disabled={creating} className={btnPrimary}>
              {creating ? "Creating…" : "+ New paper"}
            </button>
            <button onClick={handleSignOut} className={btnSecondary}>
              Sign out
            </button>
          </div>
        </div>

        {!loading && documents.length > 0 && (
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your papers…"
            className={`${inputBase} max-w-xs mb-6`}
          />
        )}

        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : documents.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-sm text-gray-400 mb-4">No papers yet — create one to get started.</p>
            <button onClick={handleCreate} disabled={creating} className={btnPrimary}>
              {creating ? "Creating…" : "+ New paper"}
            </button>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <p className="text-sm text-gray-400">No papers match "{search}".</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
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
        {duplicatingId && <p className="text-xs text-gray-400 mt-4">Duplicating…</p>}
      </div>
    </div>
  );
}
