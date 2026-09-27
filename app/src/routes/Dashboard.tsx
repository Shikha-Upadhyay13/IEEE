import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Copy, FileText, MoreVertical, Plus, Trash2 } from "lucide-react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../lib/useAuth";
import { createBlankDocument } from "../lib/blankDocument";
import { STARTER_TEMPLATES, type StarterTemplateId } from "../lib/starterTemplates";
import { Menu } from "../components/ui/Menu";
import { relativeTime } from "../lib/relativeTime";
import { inputBase } from "../lib/uiClasses";
import { friendlyErrorMessage } from "../lib/friendlyError";
import { DashboardSidebar } from "../components/dashboard/DashboardSidebar";
import { PaperThumbnail } from "../components/dashboard/PaperThumbnail";
import { OnboardingWizard } from "../components/dashboard/OnboardingWizard";
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
        className="w-7 h-7 rounded-md hover:bg-canvas text-muted hover:text-ink flex items-center justify-center transition-colors"
      >
        <MoreVertical size={16} aria-hidden="true" />
      </button>
      {open && (
        <div className="absolute right-0 bottom-full mb-1 w-36 bg-surface border border-line rounded-lg shadow-lg py-1 z-10 text-sm">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
              setOpen(false);
            }}
            className="w-full flex items-center gap-2 text-left px-3 py-1.5 hover:bg-canvas text-ink"
          >
            <Copy size={14} aria-hidden="true" />
            Duplicate
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
              setOpen(false);
            }}
            className="w-full flex items-center gap-2 text-left px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400"
          >
            <Trash2 size={14} aria-hidden="true" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function NewPaperCard({ creating, onCreate }: { creating: boolean; onCreate: (template: StarterTemplateId) => void }) {
  return (
    <Menu
      trigger={
        <>
          <Plus size={28} strokeWidth={1.5} aria-hidden="true" />
          <span className="text-sm font-medium">{creating ? "Creating…" : "New paper"}</span>
        </>
      }
      disabled={creating}
      width={320}
      triggerClassName="aspect-[8.5/11] w-full rounded-xl border-2 border-dashed border-line flex flex-col items-center justify-center gap-2 text-muted hover:border-accent hover:text-accent hover:bg-accent-soft/50 transition-colors"
      groups={[
        {
          label: "Start from",
          items: STARTER_TEMPLATES.map((t) => ({
            id: t.id,
            label: t.name,
            description: t.description,
            icon: FileText,
            onSelect: () => onCreate(t.id),
          })),
        },
      ]}
    />
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
        className="group relative aspect-[8.5/11] w-full rounded-xl border border-line shadow-sm hover:shadow-md hover:border-accent transition-all overflow-hidden bg-surface"
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
              className="w-full text-sm font-medium text-ink bg-surface border border-accent rounded px-1.5 py-0.5 -mx-1.5 focus:outline-none focus:ring-2 focus:ring-accent"
            />
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="text-sm font-medium text-ink hover:text-accent text-left truncate block w-full"
              title={`${doc.title || "Untitled paper"} (click to rename)`}
            >
              {doc.title || "Untitled paper"}
            </button>
          )}
          <p className="text-xs text-muted mt-0.5">edited {relativeTime(doc.updated_at)}</p>
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
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
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
        setLoadError(error ? friendlyErrorMessage(error, "Couldn't load your papers.") : null);
        const docs = data ?? [];
        setDocuments(docs);
        setLoading(false);

        // Check if user has completed onboarding
        if (user) {
          const cached = localStorage.getItem(`ieee_onboarding_${user.id}`);
          if (!cached) {
            try {
              const { data: profile } = await supabase
                .from("profiles")
                .select("has_completed_onboarding")
                .eq("id", user.id)
                .maybeSingle();

              if (!profile || !profile.has_completed_onboarding) {
                if (docs.length === 0 || !profile?.has_completed_onboarding) {
                  setShowOnboarding(true);
                }
              }
            } catch {
              // If profiles table isn't migrated yet, show onboarding if 0 documents
              if (docs.length === 0) {
                setShowOnboarding(true);
              }
            }
          }
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user, reloadToken]);

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

  async function handleCreate(template: StarterTemplateId) {
    if (!user) return;
    setCreating(true);
    const blank = createBlankDocument(template);
    const { data, error } = await supabase
      .from("documents")
      .insert({ owner_id: user.id, title: "Untitled paper", content: blank })
      .select("id")
      .single();
    setCreating(false);
    if (error) {
      console.error("Failed to create document:", error);
      setActionError(friendlyErrorMessage(error, "Couldn't create a new paper."));
      return;
    }
    navigate(`/editor/${data.id}`);
  }

  async function handleRename(id: string, title: string) {
    setDocuments((docs) => docs.map((d) => (d.id === id ? { ...d, title } : d)));
    const { error } = await supabase.from("documents").update({ title }).eq("id", id);
    if (error) {
      console.error("Failed to rename document:", error);
      setActionError(friendlyErrorMessage(error, "Couldn't rename that paper."));
    }
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
      setActionError(friendlyErrorMessage(err, "Couldn't duplicate that paper."));
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
      setActionError(friendlyErrorMessage(error, "Couldn't delete that paper."));
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    // Explicit navigation rather than relying on RequireAuth's reactive
    // redirect — deterministic regardless of any auth-listener timing.
    navigate("/login");
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-canvas">
      <DashboardSidebar onSignOut={handleSignOut} />

      <div className="flex-1 min-w-0 px-4 py-6 sm:px-8 sm:py-10">
        <div className="max-w-5xl mx-auto">
          <div className="flex justify-between items-end mb-6">
            <div>
              <h1 className="font-display text-2xl font-semibold text-ink tracking-tight">My Papers</h1>
              <p className="text-sm text-muted">Your first paper is free forever.</p>
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

          {(loadError || actionError) && (
            <div
              role="alert"
              className="mb-6 flex items-start justify-between gap-3 rounded-md border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400"
            >
              <span>{loadError ?? actionError}</span>
              {loadError ? (
                <button
                  type="button"
                  onClick={() => {
                    setLoading(true);
                    setReloadToken((t) => t + 1);
                  }}
                  className="flex-none font-medium underline hover:no-underline"
                >
                  Try again
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setActionError(null)}
                  aria-label="Dismiss"
                  className="flex-none font-medium underline hover:no-underline"
                >
                  Dismiss
                </button>
              )}
            </div>
          )}

          {loading ? (
            // Skeleton grid shaped like the real card layout, not a bare
            // "Loading…" line — the sidebar/header are already rendered by
            // this point, so a full-page spinner would be a step backwards.
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <div className="aspect-[8.5/11] w-full rounded-xl bg-line animate-pulse" />
                  <div className="h-3.5 w-2/3 rounded bg-line animate-pulse" />
                </div>
              ))}
            </div>
          ) : filteredDocuments.length === 0 && search ? (
            <p className="text-sm text-muted">No papers match "{search}".</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
              <NewPaperCard creating={creating} onCreate={handleCreate} />
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
          {duplicatingId && <p className="text-xs text-muted mt-4">Duplicating…</p>}
        </div>
      </div>
      {ConfirmDialog}
      {user && (
        <OnboardingWizard
          userId={user.id}
          isOpen={showOnboarding}
          onClose={() => setShowOnboarding(false)}
        />
      )}
    </div>
  );
}
