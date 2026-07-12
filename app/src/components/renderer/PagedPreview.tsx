import { useEffect, useRef, useState } from "react";
import type { ResolvedDocument } from "../../types/document";
import { IEEEConferenceTemplate } from "./IEEEConferenceTemplate";
import { paginateInto } from "../../lib/pagination/pagedjs-adapter";
import ieeeTemplateCssUrl from "../../styles/ieee-template.css?url";

/**
 * Renders `document` twice: once into a hidden "source" container (plain,
 * unpaginated HTML), then hands that HTML to Paged.js, which chunks it into
 * real letter-sized, two-column pages inside the visible "target" container.
 * This is deliberately the only place the two containers meet — everything
 * upstream (IEEEConferenceTemplate) has no idea pagination exists.
 */
export function PagedPreview({ document }: { document: ResolvedDocument }) {
  const sourceRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"idle" | "paginating" | "done" | "error">("idle");

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!sourceRef.current || !targetRef.current) return;
      setStatus("paginating");
      try {
        await paginateInto(sourceRef.current, targetRef.current, [ieeeTemplateCssUrl]);
        if (!cancelled) setStatus("done");
      } catch (err) {
        console.error("Paged.js pagination failed:", err);
        if (!cancelled) setStatus("error");
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [document]);

  return (
    <div>
      {status === "paginating" && <p>Paginating…</p>}
      {status === "error" && <p style={{ color: "red" }}>Pagination failed — see console.</p>}

      {/* Hidden source: plain unpaginated render, read by Paged.js. */}
      <div
        ref={sourceRef}
        aria-hidden="true"
        style={{ position: "absolute", left: "-99999px", top: 0 }}
      >
        <IEEEConferenceTemplate document={document} />
      </div>

      {/* Visible target: Paged.js injects the real paginated pages here. */}
      <div ref={targetRef} className="paged-preview-target" />
    </div>
  );
}
