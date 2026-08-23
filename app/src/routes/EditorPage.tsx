import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { resolveNumbering } from "../lib/numbering";
import { useDocumentStore } from "../store/documentStore";
import { useDebouncedValue } from "../lib/useDebouncedValue";
import { PagedPreview } from "../components/renderer/PagedPreview";
import { EditorPanel } from "../components/editor/EditorPanel";
import { ExportButton } from "../components/editor/ExportButton";
import { supabase } from "../supabaseClient";
import { btnGhost } from "../lib/uiClasses";
import type { Document } from "../types/document";

function extractTitleText(doc: Document): string {
  return doc.titleBlock.title.map((n) => (n.type === "text" ? n.text : "")).join("") || "Untitled paper";
}

export function EditorPage() {
  const { documentId } = useParams<{ documentId: string }>();
  const document = useDocumentStore((s) => s.document);
  const loadedDocumentId = useDocumentStore((s) => s.documentId);
  const loadDocument = useDocumentStore((s) => s.loadDocument);

  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
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
  // Always the latest document, independent of the save debounce — read by
  // the unmount flush below, which must not act on a stale closed-over value.
  const latestDocument = useRef(document);
  latestDocument.current = document;

  useEffect(() => {
    if (!documentId) return;
    let cancelled = false;
    setLoadState("loading");
    supabase
      .from("documents")
      .select("content")
      .eq("id", documentId)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setLoadState("error");
          return;
        }
        const content = data.content as Document;
        lastSavedContent.current = content;
        loadDocument(documentId, content);
        setLoadState("ready");
      });
    return () => {
      cancelled = true;
    };
    // Only re-run when navigating to a *different* document id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  // Debounced autosave: waits for edits to pause before writing to Supabase,
  // same rationale as the pagination debounce — just a longer pause, since
  // network round-trips are more expensive than a re-layout.
  const debouncedForSave = useDebouncedValue(document, 2000);
  useEffect(() => {
    if (loadState !== "ready" || !documentId || loadedDocumentId !== documentId) return;
    if (debouncedForSave === lastSavedContent.current) return; // genuinely unedited since last save
    setSaveState("saving");
    supabase
      .from("documents")
      .update({ title: extractTitleText(debouncedForSave), content: debouncedForSave })
      .eq("id", documentId)
      .then(({ error }) => {
        if (!error) lastSavedContent.current = debouncedForSave;
        setSaveState(error ? "error" : "saved");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedForSave]);

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
      if (!documentId || lastSavedContent.current === null) return;
      if (latestDocument.current === lastSavedContent.current) return;
      const finalContent = latestDocument.current;
      supabase
        .from("documents")
        .update({ title: extractTitleText(finalContent), content: finalContent })
        .eq("id", documentId)
        .then(({ error }) => {
          if (error) console.error("Final save on navigate-away failed:", error);
        });
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

  useEffect(() => {
    if (!previewOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setPreviewOpen(false);
    }
    window.document.addEventListener("keydown", handleKeyDown);
    return () => window.document.removeEventListener("keydown", handleKeyDown);
  }, [previewOpen]);

  if (loadState === "loading") {
    return <p className="p-6 text-sm text-gray-500">Loading paper…</p>;
  }
  if (loadState === "error") {
    return (
      <p className="p-6 text-sm text-gray-500">
        Couldn't load that paper — it may not exist, or you may not have access.
      </p>
    );
  }

  const saveLabel =
    saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "error" ? "Save failed" : "";
  const saveLabelClass =
    saveState === "error" ? "text-red-600" : saveState === "saving" ? "text-gray-400" : "text-emerald-600";

  return (
    <div className="h-screen flex flex-col">
      {/* Top bar spans both panes — mirrors the reference layout's header:
          navigation/status on the left, the primary action (export) on the
          right, both reachable regardless of what's happening below. */}
      <div className="flex-none flex justify-between items-center px-6 py-3 border-b border-gray-200 bg-white z-20">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">
            ← Dashboard
          </Link>
          <span className="text-gray-300">|</span>
          <span className={`text-xs font-medium ${saveLabelClass}`}>{saveLabel}</span>
        </div>
        {documentId && <ExportButton documentId={documentId} compact />}
      </div>

      <div className="flex-1 min-h-0 flex">
        <div className="w-[460px] flex-shrink-0 h-full overflow-hidden border-r border-gray-200 bg-white">
          <EditorPanel />
        </div>

        {/* Light neutral backdrop (not the sidebar's white, not a heavy dark
            gray) so the white page reads as the clear focal point — same
            contrast relationship as the reference's page-on-canvas layout. */}
        <div
          className={
            previewOpen
              ? "fixed inset-0 z-50 bg-gray-100 overflow-y-auto py-10"
              : "flex-1 relative overflow-y-auto bg-gray-100 py-10"
          }
        >
          {previewOpen && (
            <button
              onClick={() => setPreviewOpen(false)}
              aria-label="Close preview"
              className={`${btnGhost} fixed top-4 right-4 z-[60] bg-white shadow-md w-auto px-3 gap-1.5 text-xs font-medium`}
            >
              ✕ Close preview
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
                  🔍 Click to preview full screen
                </span>
              </div>
            )}
            <PagedPreview document={resolvedDoc} />
          </div>
        </div>
      </div>
    </div>
  );
}
