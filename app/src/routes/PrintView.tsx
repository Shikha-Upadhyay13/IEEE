import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { resolveNumbering } from "../lib/numbering";
import { PagedPreview } from "../components/renderer/PagedPreview";
import { supabase } from "../supabaseClient";
import { parseDocument } from "../lib/parseDocument";
import type { Document } from "../types/document";

/**
 * Chrome-less print view: the same render pipeline as the editor
 * (fetched content -> resolveNumbering -> PagedPreview), with no editor UI
 * around it. The PDF export service navigates here and prints exactly what
 * this renders — never a second copy of the layout logic.
 *
 * Two ways to load the document, matching who's asking:
 * - A `token` query param (minted via the create_export_token RPC) — the
 *   headless pdf-service path, which has no user session at all.
 * - No token: falls back to a normal authenticated fetch by id, so a logged-
 *   in user can visit /print/:documentId directly themselves and see the
 *   same thing the export would produce.
 */
export function PrintView() {
  const { documentId } = useParams<{ documentId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [paperContent, setPaperContent] = useState<Document | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!documentId) return;
    let cancelled = false;

    async function load() {
      let raw: unknown = null;
      if (token) {
        const { data, error } = await supabase.rpc("get_document_by_export_token", {
          export_token: token,
        });
        if (cancelled) return;
        raw = error ? null : data;
      } else {
        const { data, error } = await supabase
          .from("documents")
          .select("content")
          .eq("id", documentId)
          .single();
        if (cancelled) return;
        raw = error || !data ? null : data.content;
      }
      const parsed = raw ? parseDocument(raw) : null;
      if (!parsed?.ok) {
        if (parsed) console.error("Paper failed validation:", parsed.error);
        setLoadError(true);
        return;
      }
      setPaperContent(parsed.document);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [documentId, token]);

  const resolvedDoc = useMemo(() => (paperContent ? resolveNumbering(paperContent) : null), [paperContent]);

  useEffect(() => {
    window.document.title = "print-view";
  }, []);

  if (loadError) return <p>Couldn't load this document (missing, expired token, or no access).</p>;
  if (!resolvedDoc) return null; // no render-ready signal yet — pdf-service keeps waiting, correctly

  return (
    <PagedPreview
      document={resolvedDoc}
      onReady={() => window.document.body.setAttribute("data-render-ready", "true")}
    />
  );
}
