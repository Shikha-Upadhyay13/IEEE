import { useEffect, useMemo } from "react";
import { resolveNumbering } from "../lib/numbering";
import { samplePaper } from "../data/samplePaper";
import { PagedPreview } from "../components/renderer/PagedPreview";

/**
 * Chrome-less print view: the same render pipeline as the editor (samplePaper
 * -> resolveNumbering -> PagedPreview), with no editor UI around it. The PDF
 * export service navigates here and prints exactly what this renders — never
 * a second copy of the layout logic.
 *
 * NOTE: this currently always renders the hardcoded `samplePaper`, since there
 * is no document storage/auth yet (that arrives in Milestone 6 per
 * ARCHITECTURE.md). Once documents are persisted, this will read a
 * `documentId` from the URL and fetch the real document instead.
 */
export function PrintView() {
  const resolvedDoc = useMemo(() => resolveNumbering(samplePaper), []);

  useEffect(() => {
    document.title = "print-view";
  }, []);

  return <PagedPreview document={resolvedDoc} onReady={() => {
    document.body.setAttribute("data-render-ready", "true");
  }} />;
}
