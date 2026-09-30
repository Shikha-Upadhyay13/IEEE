import { useEffect, useRef, useState } from "react";
import { IEEEConferenceTemplate } from "./IEEEConferenceTemplate";
import type { ResolvedDocument } from "../../types/document";

// .ieee-paper's fixed width (see ieee-template.css) — 180mm at 96dpi, a fixed
// physical size regardless of the card it's shrunk into.
const NATURAL_WIDTH_PX = (180 / 25.4) * 96;
// The rendered page fills this fraction of the card's actual (responsive)
// width — the rest is gray margin left/right, same visual idea as the real
// editor preview's page-floating-on-a-gray-backdrop treatment.
const PAGE_WIDTH_RATIO = 0.86;

/**
 * A cheap approximation of "page 1 of this paper", not real pagination —
 * renders the same template used everywhere else, zoomed down to fit inside
 * a clipped, letter-ratio card, so the top of the continuous (unpaginated)
 * flow stands in for the first page. Running Paged.js per card (like the
 * live editor preview does) would be far too expensive for a grid of papers.
 *
 * Uses CSS `zoom` rather than `transform: scale` deliberately: zoom actually
 * reflows the box to its post-zoom size, so centering it in its container
 * with plain flexbox just works — transform is visual-only and would need
 * separate offset math to center a box whose layout size doesn't match what
 * you see.
 */
export function DocumentThumbnail({ document }: { document: ResolvedDocument | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<number | null>(null);

  // Cards resize across grid breakpoints — measuring rather than assuming a
  // fixed card width keeps the page proportionally centered at every size.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setZoom((width * PAGE_WIDTH_RATIO) / NATURAL_WIDTH_PX);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      inert
      className="w-full h-full overflow-hidden bg-canvas flex justify-center pointer-events-none select-none"
      style={{ paddingTop: "7%" }}
    >
      {document && zoom ? (
        // The rendered page itself deliberately stays white always, in both
        // themes — it represents literal paper.
        <div className="flex-none bg-white shadow-sm" style={{ width: NATURAL_WIDTH_PX, zoom }}>
          <IEEEConferenceTemplate document={document} />
        </div>
      ) : (
        <div className="w-[86%] h-[80%] bg-line rounded-sm animate-pulse" />
      )}
    </div>
  );
}
