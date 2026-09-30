import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import { resolveNumbering } from "../../lib/numbering";
import { DocumentThumbnail } from "../renderer/DocumentThumbnail";
import type { Document, ResolvedDocument } from "../../types/document";

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
        setResolved(resolveNumbering(data.content as Document));
      });
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  return <DocumentThumbnail document={resolved} />;
}
