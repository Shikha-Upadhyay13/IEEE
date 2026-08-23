import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import { resolveNumbering } from "../../lib/numbering";
import { IEEEConferenceTemplate } from "../renderer/IEEEConferenceTemplate";
import type { Document, ResolvedDocument } from "../../types/document";

// .ieee-paper's fixed width (see ieee-template.css) — 180mm at 96dpi. The
// scale factor below is relative to this, not a guess, so the thumbnail
// stays proportionally accurate to the real rendered page.
const NATURAL_WIDTH_PX = (180 / 25.4) * 96;
const THUMBNAIL_WIDTH_PX = 220;
const SCALE = THUMBNAIL_WIDTH_PX / NATURAL_WIDTH_PX;

/**
 * A cheap approximation of "page 1 of this paper", not real pagination —
 * renders the same template used everywhere else at a fixed scale inside a
 * clipped, letter-ratio box, so the top of the continuous (unpaginated) flow
 * stands in for the first page. Good enough for a dashboard card; running
 * Paged.js per card (like the live editor preview does) would be far too
 * expensive to do for a whole grid of papers at once.
 */
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

  if (!resolved) {
    return <div className="w-full h-full bg-gray-100 animate-pulse" />;
  }

  return (
    <div className="w-full h-full overflow-hidden bg-white pointer-events-none select-none">
      <div style={{ width: NATURAL_WIDTH_PX, transform: `scale(${SCALE})`, transformOrigin: "top left" }}>
        <IEEEConferenceTemplate document={resolved} />
      </div>
    </div>
  );
}
