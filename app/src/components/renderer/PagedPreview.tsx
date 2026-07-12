import { useEffect, useRef, useState } from "react";
import type { ResolvedDocument } from "../../types/document";
import { IEEEConferenceTemplate } from "./IEEEConferenceTemplate";
import { paginate } from "../../lib/pagination/pagedjs-adapter";
import ieeeTemplateCssUrl from "../../styles/ieee-template.css?url";

/**
 * Renders `document` twice: once into a hidden "source" container (plain,
 * unpaginated HTML), then hands that HTML to Paged.js, which chunks it into
 * real letter-sized, two-column pages. This is deliberately the only place
 * the two containers meet — everything upstream (IEEEConferenceTemplate) has
 * no idea pagination exists.
 *
 * Pagination result is only committed to the visible target if this effect
 * run is still the latest one (guarded by the `cancelled` flag) — otherwise
 * a superseded run (React StrictMode's dev-mode double-invoke, or two rapid
 * edits in production) would race a newer run and duplicate/corrupt the
 * visible output. The stale run's work happens entirely in a detached
 * DocumentFragment (see paginate()) and is simply discarded.
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
        const fragment = await paginate(sourceRef.current.innerHTML, [ieeeTemplateCssUrl]);
        if (cancelled) return; // stale run — discard without touching the visible DOM
        targetRef.current.replaceChildren(fragment);
        setStatus("done");
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

      {/* Visible target: the winning run's paginated pages land here. */}
      <div ref={targetRef} className="paged-preview-target" />
    </div>
  );
}
