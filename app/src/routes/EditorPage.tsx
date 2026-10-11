import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, History, Maximize2, MessageSquareText, Redo2, Undo2, X } from "lucide-react";
import { ReviewPanel } from "../components/editor/ReviewPanel";
import { redo, undo, useHistoryStore } from "../store/historyStore";
import { resolveNumbering } from "../lib/numbering";
import { useDocumentStore } from "../store/documentStore";
import { useDebouncedValue } from "../lib/useDebouncedValue";
import { PagedPreview } from "../components/renderer/PagedPreview";
import { EditorPanel, type EditorView } from "../components/editor/EditorPanel";
import { EditorOutline } from "../components/editor/EditorOutline";
import { ChecklistPanel } from "../components/editor/ChecklistPanel";
import { useChecklist } from "../components/editor/useChecklist";
import { exportBlocked } from "../lib/readinessReport";
import { ExportButton } from "../components/editor/ExportButton";
import { ShareButton } from "../components/editor/ShareButton";
import { VersionHistoryPanel } from "../components/editor/VersionHistoryPanel";
import { supabase } from "../supabaseClient";
import { saveDocument } from "../lib/documentWrites";
import { createSnapshot } from "../lib/versions";
import { parseDocument } from "../lib/parseDocument";
import { useAuth } from "../lib/useAuth";
import { btnGhost, btnIcon, btnPrimary, btnSecondary } from "../lib/uiClasses";
import { LoadingScreen } from "../components/LoadingScreen";
import { BrandMark } from "../components/BrandMark";
import { extractTitleText } from "../lib/extractTitleText";
import { usePageMeta } from "../lib/usePageMeta";
import type { Document } from "../types/document";

export function EditorPage() {
  const { documentId } = useParams<{ documentId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const document = useDocumentStore((s) => s.document);
  const loadedDocumentId = useDocumentStore((s) => s.documentId);
  const loadDocument = useDocumentStore((s) => s.loadDocument);

  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [view, setView] = useState<EditorView>({ kind: "all" });
  const [reviewOpen, setReviewOpen] = useState(false);
  // The last content known to be persisted — compared by reference (not a
  // fire-count flag) against the debounced value below, so autosave skips
  // only a genuinely unchanged state, not just "the first debounce cycle"
  // (which would wrongly eat a real edit if the user starts typing before
  // that cycle elapses — the debounce timer keeps resetting, so fast edits
  // right after load can reach the effect on their very first fire with no
  // separate "unedited load" fire ever having happened). Updated on load AND
  // after every successful save, so the flush-on-navigate-away check below
  // (not just the debounced autosave) knows what's actually safe to skip.
  const lastSavedContent = useRef<Document | null>(null);
  // documents.version of lastSavedContent; every save must start from it.
  const savedVersion = useRef(0);
  // Set when someone else saved first; autosave pauses until the user picks a side.
  const [conflict, setConflict] = useState(false);
  const conflictRef = useRef(false);
  conflictRef.current = conflict;
  const [reloadKey, setReloadKey] = useState(0);
  // Always the latest document, independent of the save debounce — read by
  // the unmount flush below, which must not act on a stale closed-over value.
  const latestDocument = useRef(document);
  latestDocument.current = document;
  usePageMeta({ title: (document && extractTitleText(document)) || "Untitled paper", noindex: true });

  useEffect(() => {
    if (!documentId) return;
    let cancelled = false;
    setLoadState("loading");
    (async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("content, owner_id, version")
        .eq("id", documentId)
        .single();
      if (cancelled) return;
      if (error || !data) {
        setLoadState("error");
        return;
      }
      // Owners and editors edit here; reviewers, viewers and link visitors
      // get the read-only view.
      if (user && data.owner_id !== user.id) {
        const { data: role } = await supabase.rpc("document_role", { doc: documentId });
        if (cancelled) return;
        if (role !== "editor") {
          navigate(`/view/${documentId}`, { replace: true });
          return;
        }
      }
      const parsed = parseDocument(data.content);
      if (!parsed.ok) {
        console.error("Paper failed validation:", parsed.error);
        setLoadError(parsed.error);
        setLoadState("error");
        return;
      }
      lastSavedContent.current = parsed.document;
      savedVersion.current = data.version as number;
      setConflict(false);
      loadDocument(documentId, parsed.document);
      setLoadState("ready");
    })();
    return () => {
      cancelled = true;
    };
    // Only re-run when navigating to a *different* document id, or when the
    // user chooses to load someone else's newer save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, reloadKey]);

  // Debounced autosave: waits for edits to pause before writing to Supabase,
  // same rationale as the pagination debounce — just a longer pause, since
  // network round-trips are more expensive than a re-layout.
  const debouncedForSave = useDebouncedValue(document, 2000);
  async function persist(id: string, content: Document, expectedVersion: number) {
    setSaveState("saving");
    const result = await saveDocument(id, { title: extractTitleText(content), content }, expectedVersion);
    if (result.status === "saved") {
      lastSavedContent.current = content;
      savedVersion.current = result.version;
      setSaveState("saved");
    } else if (result.status === "conflict") {
      setConflict(true);
      setSaveState("idle");
    } else {
      console.error("Autosave failed:", result.error);
      setSaveState("error");
    }
  }

  useEffect(() => {
    if (loadState !== "ready" || !documentId || loadedDocumentId !== documentId || conflict) return;
    if (debouncedForSave === lastSavedContent.current) return; // genuinely unedited since last save
    void persist(documentId, debouncedForSave, savedVersion.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedForSave]);

  async function keepMine() {
    if (!documentId) return;
    const { data } = await supabase.from("documents").select("content, version").eq("id", documentId).maybeSingle();
    if (!data) return;
    const { error } = await createSnapshot(documentId, "Co-author's version, replaced by Keep mine", data.content);
    if (error) {
      console.error("Snapshot before Keep mine failed:", error);
      setSaveState("error");
      return;
    }
    setConflict(false);
    await persist(documentId, latestDocument.current, data.version as number);
  }

  async function loadTheirs() {
    if (!documentId) return;
    const { error } = await createSnapshot(documentId, "Your edits, replaced by a co-author's version", latestDocument.current);
    if (error) {
      console.error("Snapshot before loading their version failed:", error);
      setSaveState("error");
      return;
    }
    lastSavedContent.current = null;
    setReloadKey((k) => k + 1);
  }

  // Flush-on-navigate-away: without this, edits made within the last 2s
  // before leaving the editor (e.g. clicking "Dashboard" right after typing)
  // would never reach the debounced effect above and would be silently lost
  // — caught by testing the "back to dashboard" flow right after an edit.
  //
  // lastSavedContent.current === null is a required guard, not an edge case:
  // React 18 StrictMode mounts this component, immediately unmounts it (to
  // verify cleanup logic), then remounts it — and that first synthetic
  // unmount's cleanup can run before the load-on-mount fetch above has
  // resolved. Without this guard, the flush would fire with whatever content
  // happened to be sitting in the store from a *previous* document (or the
  // module's default sample), silently overwriting a brand-new document with
  // stale, unrelated content. Caught by testing "+ New paper" end-to-end —
  // the freshly created blank document showed old sample content instead.
  useEffect(() => {
    return () => {
      if (!documentId || lastSavedContent.current === null || conflictRef.current) return;
      if (latestDocument.current === lastSavedContent.current) return;
      const finalContent = latestDocument.current;
      saveDocument(documentId, { title: extractTitleText(finalContent), content: finalContent }, savedVersion.current).then(
        (result) => {
          if (result.status !== "saved") console.error("Final save on navigate-away failed:", result);
        },
      );
    };
  }, [documentId]);

  // The flush-on-navigate-away effect above only helps for in-app SPA
  // navigation (e.g. clicking the Dashboard link), where React's cleanup
  // effect has time to let its async Supabase call finish. An actual browser-
  // level navigation — closing the tab, typing a new URL, hitting refresh —
  // tears down the JS context before that call can complete, and Supabase's
  // authenticated requests can't use navigator.sendBeacon (no custom auth
  // header support) as a reliable alternative. So instead of a silent save
  // that might not finish, warn before the browser actually leaves — the same
  // pattern Google Docs/Notion use for this exact constraint.
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (lastSavedContent.current !== null && latestDocument.current !== lastSavedContent.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const debouncedForPreview = useDebouncedValue(document, 250);
  const resolvedDoc = useMemo(() => resolveNumbering(debouncedForPreview), [debouncedForPreview]);

  // In-app overlay rather than the browser Fullscreen API: clicking the
  // document should feel like FlowCV's "click to preview" — instant, no OS
  // permission dance, works the same in every browser. PagedPreview stays
  // mounted in the same JSX position in both states (only the wrapping
  // classNames change) so toggling this never remounts it and re-triggers
  // Paged.js pagination.
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const checklistItems = useChecklist(pageCount);
  const exportBlockers = exportBlocked(document, checklistItems)
    ? checklistItems.filter((i) => i.status === "fail").length
    : 0;

  const canUndo = useHistoryStore((s) => s.past.length > 0);
  const canRedo = useHistoryStore((s) => s.future.length > 0);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      const isUndo = key === "z" && !e.shiftKey;
      const isRedo = (key === "z" && e.shiftKey) || key === "y";
      if (!isUndo && !isRedo) return;
      // Paragraph text and equations keep their own fine-grained undo while focused.
      const target = e.target as HTMLElement | null;
      if (target?.closest(".ProseMirror, math-field")) return;
      e.preventDefault();
      if (isUndo) undo();
      else redo();
    }
    window.document.addEventListener("keydown", handleKeyDown);
    return () => window.document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!previewOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setPreviewOpen(false);
    }
    window.document.addEventListener("keydown", handleKeyDown);
    return () => window.document.removeEventListener("keydown", handleKeyDown);
  }, [previewOpen]);

  if (loadState === "loading") {
    return <LoadingScreen label="Loading paper…" />;
  }
  if (loadState === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-canvas px-6 text-center">
        <BrandMark size="lg" className="bg-muted text-accent-fg" />
        <p className="text-sm text-muted max-w-sm">
          {loadError
            ? "This paper's saved data couldn't be read, so it was not opened (nothing was changed). Restore an earlier version or contact support."
            : "Couldn't load that paper — it may not exist, or you may not have access."}
        </p>
        {loadError && <p className="text-xs text-muted max-w-sm font-mono break-words">{loadError}</p>}
        <Link to="/dashboard" className={btnPrimary}>
          <ArrowLeft size={14} aria-hidden="true" />
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const saveLabel =
    saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "error" ? "Save failed" : "";
  const saveLabelClass =
    saveState === "error"
      ? "text-red-600 dark:text-red-400"
      : saveState === "saving"
        ? "text-muted"
        : "text-emerald-600 dark:text-emerald-400";

  function navigateTo(next: EditorView, blockId?: string) {
    setView(next);
    if (!blockId) return;
    // Wait for the newly selected view to render before looking the block up.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const el = window.document.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(blockId)}"]`);
        if (!el) return;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-accent");
        window.setTimeout(() => el.classList.remove("ring-2", "ring-accent"), 1600);
      }),
    );
  }

  const pageLimit = document.meta.pageLimit;
  const overPageLimit = pageCount !== null && pageLimit !== null && pageCount > pageLimit;

  return (
    <div className="h-screen flex flex-col">
      {conflict && (
        <div
          role="alert"
          className="flex-none flex flex-wrap items-center gap-3 px-6 py-2.5 border-b border-amber-200 bg-amber-50 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200"
        >
          <span className="flex-1 min-w-60">
            This paper changed since you opened it — a co-author saved first. Your recent edits are paused, not lost.
          </span>
          <button
            type="button"
            onClick={loadTheirs}
            title="Discards your unsaved edits. Earlier versions stay in History."
            className={`${btnSecondary} text-xs py-1.5 px-3`}
          >
            Load their version
          </button>
          <button
            type="button"
            onClick={keepMine}
            title="Replaces their changes with yours. Their version stays in History."
            className={`${btnPrimary} text-xs py-1.5 px-3`}
          >
            Keep mine
          </button>
        </div>
      )}
      {/* Top bar spans both panes — mirrors the reference layout's header:
          navigation/status on the left, the primary action (export) on the
          right, both reachable regardless of what's happening below. */}
      <div className="flex-none flex justify-between items-center px-6 py-3 border-b border-line bg-surface z-20">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink transition-colors"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            Dashboard
          </Link>
          <span className="text-muted/60">|</span>
          <span className={`text-xs font-medium ${saveLabelClass}`}>{saveLabel}</span>
          {pageCount !== null && (
            <span
              className={`text-xs font-medium ${overPageLimit ? "rounded bg-amber-50 px-1.5 py-0.5 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400" : "text-muted"}`}
              aria-live="polite"
              title={overPageLimit ? `Your venue allows ${pageLimit} pages — trim content or adjust the limit in Paper Details.` : undefined}
            >
              {pageLimit ? `${pageCount} / ${pageLimit} pages` : `${pageCount} ${pageCount === 1 ? "page" : "pages"}`}
              {overPageLimit && ` — ${pageCount - pageLimit} over limit`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center">
            <button
              type="button"
              onClick={undo}
              disabled={!canUndo}
              aria-label="Undo"
              title="Undo (Ctrl+Z)"
              className={`${btnIcon} disabled:opacity-40`}
            >
              <Undo2 size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={!canRedo}
              aria-label="Redo"
              title="Redo (Ctrl+Shift+Z)"
              className={`${btnIcon} disabled:opacity-40`}
            >
              <Redo2 size={16} aria-hidden="true" />
            </button>
          </div>
          <ChecklistPanel items={checklistItems} onNavigate={navigateTo} />
          <button
            type="button"
            onClick={() => setReviewOpen(true)}
            className={`${btnSecondary} text-xs py-1.5 px-3 flex items-center gap-1.5`}
            title="AI feedback on clarity and structure"
          >
            <MessageSquareText size={14} aria-hidden="true" />
            <span>Review</span>
          </button>
          {documentId && (
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className={`${btnSecondary} text-xs py-1.5 px-3 flex items-center gap-1.5`}
              title="Version history"
            >
              <History size={14} aria-hidden="true" />
              <span>History</span>
            </button>
          )}
          {documentId && <ShareButton documentId={documentId} />}
          {documentId && (
            <ExportButton documentId={documentId} title={extractTitleText(document)} blockers={exportBlockers} compact />
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 flex">
        <div className="hidden lg:flex w-56 flex-none flex-col border-r border-line bg-surface">
          <EditorOutline view={view} onChange={setView} />
        </div>
        <main
          id="main-content"
          tabIndex={-1}
          aria-label="Paper editor"
          className="flex-1 min-w-0 h-full flex flex-col border-r border-line bg-surface focus:outline-none"
        >
          <EditorPanel view={view} />
        </main>

        {/* Light neutral backdrop (not the sidebar's white, not a heavy dark
            gray) so the white page reads as the clear focal point — same
            contrast relationship as the reference's page-on-canvas layout. */}
        <div
          className={
            previewOpen
              ? "fixed inset-0 z-50 bg-canvas overflow-y-auto py-10"
              : "w-1/2 lg:w-[45%] flex-none min-w-0 relative overflow-y-auto bg-canvas py-10"
          }
        >
          {previewOpen && (
            <button
              onClick={() => setPreviewOpen(false)}
              aria-label="Close preview"
              className={`${btnGhost} fixed top-4 right-4 z-[60] bg-surface shadow-md w-auto px-3 gap-1.5 text-xs font-medium`}
            >
              <X size={14} aria-hidden="true" />
              Close preview
            </button>
          )}

          {/* group/onClick live on this wrapper, not on PagedPreview itself,
              so the hover affordance and click target cover the whole page
              (including its margins) rather than just its text content. */}
          <div
            className={`group relative mx-auto w-fit ${previewOpen ? "" : "cursor-zoom-in"}`}
            onClick={() => !previewOpen && setPreviewOpen(true)}
          >
            {!previewOpen && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded bg-gray-900/0 opacity-0 transition-all group-hover:bg-gray-900/10 group-hover:opacity-100">
                <span className="inline-flex items-center gap-2 rounded-full bg-gray-900/85 px-4 py-2 text-sm font-medium text-white shadow-lg backdrop-blur">
                  <Maximize2 size={14} aria-hidden="true" />
                  Click to preview full screen
                </span>
              </div>
            )}
            <PagedPreview document={resolvedDoc} onPaginated={setPageCount} />
          </div>
        </div>
      </div>
      {reviewOpen && <ReviewPanel onClose={() => setReviewOpen(false)} onNavigate={(v) => navigateTo(v)} />}
      {documentId && (
        <VersionHistoryPanel
          documentId={documentId}
          currentDocument={document}
          isOpen={historyOpen}
          onClose={() => setHistoryOpen(false)}
          onRestore={(restored) => {
            loadDocument(documentId, restored);
          }}
        />
      )}
    </div>
  );
}
