import { usePageMeta } from "../lib/usePageMeta";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Archive, ArchiveRestore, Copy, FileText, MoreVertical, Plus, Trash2, Undo2, type LucideIcon } from "lucide-react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../lib/useAuth";
import { deleteDocument, updateDocument } from "../lib/documentWrites";
import { createBlankDocument } from "../lib/blankDocument";
import { track } from "../lib/monitoring";
import { takePendingTemplate, type GalleryChoice } from "../lib/pendingTemplate";
import { createSamplePaper } from "../data/samplePaper";
import { STARTER_TEMPLATES, type StarterTemplateId } from "../lib/starterTemplates";
import { Menu } from "../components/ui/Menu";
import { relativeTime } from "../lib/relativeTime";
import { inputBase } from "../lib/uiClasses";
import { friendlyErrorMessage } from "../lib/friendlyError";
import { DashboardSidebar } from "../components/dashboard/DashboardSidebar";
import { PaperThumbnail } from "../components/dashboard/PaperThumbnail";
import { OnboardingWizard } from "../components/dashboard/OnboardingWizard";
import { useConfirm } from "../components/ConfirmDialog";
import { currentWorkspace, useWorkspaceStore } from "../store/workspaceStore";
import { PAPER_VIEWS, loadPapers, parsePaperView, setArchived, setTrashed, type PaperRow } from "../lib/paperLists";

type SortOrder = "updated" | "title";

const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: "updated", label: "Last edited" },
  { value: "title", label: "Title (A–Z)" },
];

type CardAction = { label: string; icon: LucideIcon; onSelect: () => void; danger?: boolean };

function CardMenu({ actions }: { actions: CardAction[] }) {
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
        <div className="absolute right-0 bottom-full mb-1 w-44 bg-surface border border-line rounded-lg shadow-lg py-1 z-10 text-sm">
          {actions.map(({ label, icon: Icon, onSelect, danger }) => (
            <button
              key={label}
              onClick={(e) => {
                e.stopPropagation();
                onSelect();
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2 text-left px-3 py-1.5 ${
                danger ? "hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400" : "hover:bg-canvas text-ink"
              }`}
            >
              <Icon size={14} aria-hidden="true" />
              {label}
            </button>
          ))}
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
  actions,
}: {
  doc: PaperRow;
  onOpen?: () => void;
  onRename?: (title: string) => void;
  actions: CardAction[];
}) {
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(doc.title || "Untitled paper");

  function commitRename() {
    setEditing(false);
    const trimmed = draftTitle.trim();
    if (trimmed && trimmed !== doc.title) onRename?.(trimmed);
    else setDraftTitle(doc.title || "Untitled paper");
  }

  return (
    <div className="flex flex-col">
      {onOpen ? (
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
      ) : (
        <div className="relative aspect-[8.5/11] w-full rounded-xl border border-line overflow-hidden bg-surface opacity-60">
          <PaperThumbnail documentId={doc.id} />
        </div>
      )}

      <div className="flex items-start justify-between gap-1 mt-2 px-0.5">
        <div className="min-w-0">
          {editing && onRename ? (
            <input
              autoFocus
              aria-label="Paper title"
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
          ) : onRename ? (
            <button
              onClick={() => setEditing(true)}
              className="text-sm font-medium text-ink hover:text-accent text-left truncate block w-full"
              title={`${doc.title || "Untitled paper"} (click to rename)`}
            >
              {doc.title || "Untitled paper"}
            </button>
          ) : (
            <p className="text-sm font-medium text-ink truncate" title={doc.title || "Untitled paper"}>
              {doc.title || "Untitled paper"}
            </p>
          )}
          <p className="text-xs text-muted mt-0.5">
            {doc.role !== "owner" && <span className="capitalize">{doc.role} · </span>}
            edited {relativeTime(doc.updated_at)}
          </p>
        </div>
        {actions.length > 0 && <CardMenu actions={actions} />}
      </div>
    </div>
  );
}

export function Dashboard() {
  usePageMeta({ title: "Your papers", noindex: true });
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const workspaceId = useWorkspaceStore((s) => s.currentId);
  const workspace = currentWorkspace({ workspaces, currentId: workspaceId });
  const views = PAPER_VIEWS.filter((v) => v.id !== "workspace" || (workspace && !workspace.personal));
  const requestedView = parsePaperView(searchParams.get("view"));
  const view = views.some((v) => v.id === requestedView) ? requestedView : "mine";
  const viewInfo = views.find((v) => v.id === view)!;
  // Only the Workspace tab reloads when you switch workspaces.
  const listedWorkspaceId = view === "workspace" ? workspaceId : null;
  const [documents, setDocuments] = useState<PaperRow[]>([]);
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
    if (!user) return;
    let cancelled = false;
    async function load() {
      let docs: PaperRow[] = [];
      let error: unknown = null;
      try {
        docs = await loadPapers(view, user!.id, listedWorkspaceId);
      } catch (err) {
        error = err;
      }
      if (!cancelled) {
        if (error) console.error("Failed to load documents:", error);
        setLoadError(error ? friendlyErrorMessage(error, "Couldn't load your papers.") : null);
        setDocuments(docs);
        setLoading(false);

        // Check if user has completed onboarding
        if (user && view === "mine" && !error) {
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
  }, [user, reloadToken, view, listedWorkspaceId]);

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

  // A template picked on the public /templates gallery before signing in.
  useEffect(() => {
    if (!user) return;
    const pending = takePendingTemplate();
    if (pending) handleCreate(pending, "gallery");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function handleCreate(template: StarterTemplateId | GalleryChoice, source = "dashboard") {
    if (!user) return;
    setCreating(true);
    const isSample = template === "sample";
    const content = isSample ? createSamplePaper() : createBlankDocument(template);
    const title = isSample ? "Sample: Preparation of a Formatted Conference Paper" : "Untitled paper";
    const { data, error } = await supabase
      .from("documents")
      .insert({ owner_id: user.id, title, content, workspace_id: workspaceId })
      .select("id")
      .single();
    setCreating(false);
    if (error) {
      console.error("Failed to create document:", error);
      setActionError(friendlyErrorMessage(error, "Couldn't create a new paper."));
      return;
    }
    track("paper_created", { source, template });
    navigate(`/editor/${data.id}`);
  }

  async function handleRename(id: string, title: string) {
    setDocuments((docs) => docs.map((d) => (d.id === id ? { ...d, title } : d)));
    const { error } = await updateDocument(id, { title });
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
        .insert({ owner_id: user.id, title: newTitle, content: original.content, workspace_id: workspaceId })
        .select("id, title, updated_at")
        .single();
      if (insertError || !copy) throw insertError ?? new Error("Duplicate failed");

      if (view === "mine") setDocuments((docs) => [{ ...copy, role: "owner" }, ...docs]);
      else setSearchParams({});
    } catch (err) {
      console.error("Failed to duplicate document:", err);
      setActionError(friendlyErrorMessage(err, "Couldn't duplicate that paper."));
    } finally {
      setDuplicatingId(null);
    }
  }

  /** Optimistically drops the paper from the current list; puts it back if the write fails. */
  async function moveOut(id: string, write: () => Promise<{ error: Error | null }>, failure: string) {
    const previous = documents;
    setDocuments((docs) => docs.filter((d) => d.id !== id));
    const { error } = await write();
    if (error) {
      console.error(failure, error);
      setDocuments(previous);
      setActionError(friendlyErrorMessage(error, failure));
    }
  }

  async function handleDeleteForever(id: string, title: string | null) {
    const ok = await confirm({
      title: "Delete forever?",
      message: `Delete "${title || "Untitled paper"}" and its history for good? This can't be undone.`,
      confirmLabel: "Delete forever",
    });
    if (ok) await moveOut(id, () => deleteDocument(id), "Couldn't delete that paper.");
  }

  function actionsFor(doc: PaperRow): CardAction[] {
    const duplicate: CardAction = {
      label: doc.role === "owner" ? "Duplicate" : "Make a copy",
      icon: Copy,
      onSelect: () => handleDuplicate(doc.id, doc.title),
    };
    const trash: CardAction = {
      label: "Move to Trash",
      icon: Trash2,
      danger: true,
      onSelect: () => moveOut(doc.id, () => setTrashed(doc.id, true), "Couldn't move that paper to Trash."),
    };
    switch (view) {
      case "mine":
        return [
          duplicate,
          { label: "Archive", icon: Archive, onSelect: () => moveOut(doc.id, () => setArchived(doc.id, true), "Couldn't archive that paper.") },
          trash,
        ];
      case "archived":
        return [
          { label: "Unarchive", icon: ArchiveRestore, onSelect: () => moveOut(doc.id, () => setArchived(doc.id, false), "Couldn't unarchive that paper.") },
          duplicate,
          trash,
        ];
      case "trash":
        return [
          { label: "Restore", icon: Undo2, onSelect: () => moveOut(doc.id, () => setTrashed(doc.id, false), "Couldn't restore that paper.") },
          { label: "Delete forever", icon: Trash2, danger: true, onSelect: () => handleDeleteForever(doc.id, doc.title) },
        ];
      case "shared":
        return [duplicate];
      case "workspace":
        return doc.role === "owner" ? [duplicate, trash] : [duplicate];
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

      <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 px-4 py-6 sm:px-8 sm:py-10 focus:outline-none">
        <div className="max-w-5xl mx-auto">
          <div className="flex justify-between items-end mb-4">
            <div>
              <h1 className="font-display text-2xl font-semibold text-ink tracking-tight">Papers</h1>
              <p className="text-sm text-muted">Your first paper is free forever.</p>
            </div>
          </div>

          <div role="tablist" aria-label="Paper lists" className="flex gap-1 mb-6 border-b border-line overflow-x-auto">
            {views.map((v) => (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={view === v.id}
                onClick={() => {
                  if (v.id === view) return;
                  setLoading(true);
                  setSearch("");
                  setSearchParams(v.id === "mine" ? {} : { view: v.id });
                }}
                className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
                  view === v.id ? "border-accent text-accent font-medium" : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {v.id === "workspace" && workspace ? workspace.name : v.label}
              </button>
            ))}
          </div>

          {!loading && documents.length > 0 && (
            <div className="flex items-center gap-3 mb-6">
              <input
                aria-label="Search your papers"
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
          ) : view === "trash" && documents.length > 0 ? (
            <>
              <p className="text-xs text-muted mb-4">Papers in Trash are deleted for good 30 days after you move them here.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
                {filteredDocuments.map((doc) => (
                  <PaperCard key={doc.id} doc={doc} actions={actionsFor(doc)} />
                ))}
              </div>
            </>
          ) : documents.length === 0 && view !== "mine" ? (
            loadError ? null : <p className="text-sm text-muted">{viewInfo.empty}</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
              {(view === "mine" || view === "workspace") && <NewPaperCard creating={creating} onCreate={handleCreate} />}
              {filteredDocuments.map((doc) => (
                <PaperCard
                  key={doc.id}
                  doc={doc}
                  onOpen={() => navigate(`/editor/${doc.id}`)}
                  onRename={doc.role === "owner" || doc.role === "editor" ? (title) => handleRename(doc.id, title) : undefined}
                  actions={actionsFor(doc)}
                />
              ))}
            </div>
          )}
          {duplicatingId && <p className="text-xs text-muted mt-4">Duplicating…</p>}
        </div>
      </main>
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
