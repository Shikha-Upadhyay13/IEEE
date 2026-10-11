import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import { resolveNumbering } from "../../lib/numbering";
import { DocumentThumbnail } from "../renderer/DocumentThumbnail";
import { parseDocument } from "../../lib/parseDocument";
import type { ResolvedDocument } from "../../types/document";

export function PaperThumbnail({ documentId }: { documentId: string }) {
  const [resolved, setResolved] = useState<ResolvedDocument | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("documents")
      .select("content")
      .eq("id", documentId)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          console.error("Failed to load paper thumbnail:", error);
          return;
        }
        const parsed = parseDocument(data.content);
        if (parsed.ok) setResolved(resolveNumbering(parsed.document));
        else console.error("Paper thumbnail failed validation:", parsed.error);
      });
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  return <DocumentThumbnail document={resolved} />;
}
