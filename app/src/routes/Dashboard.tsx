import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { useAuth } from "../lib/useAuth";
import { createBlankDocument } from "../lib/blankDocument";
import { relativeTime } from "../lib/relativeTime";
import { btnPrimary, btnSecondary } from "../lib/uiClasses";

type DocumentRow = { id: string; title: string | null; updated_at: string };

function PaperCard({
  doc,
  onOpen,
  onRename,
  onDelete,
}: {
  doc: DocumentRow;
  onOpen: () => void;
  onRename: (title: string) => void;
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
        // input and delete button below stop propagation so they don't.
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
            title="Click to rename"
          >
            {doc.title || "Untitled paper"}
          </button>
        )}
        <p className="text-xs text-gray-400 mt-1">Edited {relativeTime(doc.updated_at)}</p>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        aria-label="Delete paper"
        className="absolute top-2 right-2 w-7 h-7 rounded-md bg-white/90 border border-gray-200 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-red-600 hover:border-red-200 transition-all flex items-center justify-center text-sm"
      >
        ✕
      </button>
    </div>
  );
}

export function Dashboard() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
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
        <div className="flex justify-between items-center mb-8">
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

        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : documents.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-sm text-gray-400 mb-4">No papers yet — create one to get started.</p>
            <button onClick={handleCreate} disabled={creating} className={btnPrimary}>
              {creating ? "Creating…" : "+ New paper"}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {documents.map((doc) => (
              <PaperCard
                key={doc.id}
                doc={doc}
                onOpen={() => navigate(`/editor/${doc.id}`)}
                onRename={(title) => handleRename(doc.id, title)}
                onDelete={() => handleDelete(doc.id, doc.title)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
