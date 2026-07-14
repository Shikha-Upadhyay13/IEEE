import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { resolveNumbering } from "../lib/numbering";
import { useDocumentStore } from "../store/documentStore";
import { useDebouncedValue } from "../lib/useDebouncedValue";
import { PagedPreview } from "../components/renderer/PagedPreview";
import { EditorPanel } from "../components/editor/EditorPanel";
import { ExportButton } from "../components/editor/ExportButton";
import { supabase } from "../supabaseClient";
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
  // The exact object just fetched from Supabase — compared by reference
  // (not a fire-count flag) against the debounced value below, so autosave
  // skips only a genuinely unchanged post-load state, not just "the first
  // debounce cycle" (which would wrongly eat a real edit if the user starts
  // typing before that cycle elapses — the debounce timer keeps resetting,
  // so fast edits right after load can reach the effect on their very first
  // fire with no separate "unedited load" fire ever having happened).
  const justLoadedContent = useRef<Document | null>(null);

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
        justLoadedContent.current = content;
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
    if (debouncedForSave === justLoadedContent.current) return; // genuinely unedited since load
    setSaveState("saving");
    supabase
      .from("documents")
      .update({ title: extractTitleText(debouncedForSave), content: debouncedForSave })
      .eq("id", documentId)
      .then(({ error }) => setSaveState(error ? "error" : "saved"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedForSave]);

  const debouncedForPreview = useDebouncedValue(document, 250);
  const resolvedDoc = useMemo(() => resolveNumbering(debouncedForPreview), [debouncedForPreview]);

  if (loadState === "loading") return <p style={{ padding: 16 }}>Loading paper…</p>;
  if (loadState === "error") return <p style={{ padding: 16 }}>Couldn't load that paper — it may not exist, or you may not have access.</p>;

  return (
    <div style={{ display: "flex" }}>
      <div style={{ width: 380, flexShrink: 0, height: "100vh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 16px" }}>
          <Link to="/">← Dashboard</Link>
          <span style={{ fontSize: 12, color: "#888" }}>
            {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "error" ? "Save failed" : ""}
          </span>
        </div>
        <EditorPanel />
        {documentId && <ExportButton documentId={documentId} />}
      </div>
      <div style={{ background: "#525659", minHeight: "100vh", padding: "24px 0", flex: 1 }}>
        <PagedPreview document={resolvedDoc} />
      </div>
    </div>
  );
}
