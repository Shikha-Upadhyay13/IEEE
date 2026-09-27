import { useRef, useState } from "react";
import { AlertTriangle, Loader2, Sparkles, X } from "lucide-react";
import { useDocumentStore } from "../../store/documentStore";
import { streamAi } from "../../lib/aiClient";
import { tokenTextToInline } from "../../lib/inlineTokens";
import type { InlineNode } from "../../types/document";
import { btnPrimary, btnSecondary, inputBase } from "../../lib/uiClasses";

type Draft = { paragraphs: InlineNode[][]; removedCitations: number; needsCitation: boolean };

function toDraft(text: string): Draft {
  let removedCitations = 0;
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean)
    .map((p) => {
      const result = tokenTextToInline(p, new Map());
      removedCitations += result.invented.length + result.strayCitations.length;
      return result.content;
    })
    .filter((c) => c.length > 0);
  const needsCitation = paragraphs.some((c) => c.some((n) => n.type === "text" && /\[citation needed\]/i.test(n.text)));
  return { paragraphs, removedCitations, needsCitation };
}

export function SectionDraftPanel({
  sectionId,
  heading,
  hasParagraphs,
  onClose,
}: {
  sectionId: string;
  heading: string;
  hasParagraphs: boolean;
  onClose: () => void;
}) {
  const document = useDocumentStore((s) => s.document);
  const insertSectionParagraphs = useDocumentStore((s) => s.insertSectionParagraphs);
  const [notes, setNotes] = useState("");
  const [streamed, setStreamed] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [replace, setReplace] = useState(hasParagraphs);
  const abortRef = useRef<AbortController | null>(null);

  async function generate() {
    if (!notes.trim()) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    setDraft(null);
    setStreamed("");
    const title = document.titleBlock.title.map((n) => (n.type === "text" ? n.text : "")).join("");
    try {
      const text = await streamAi({
        task: "draft",
        documentContext: `Paper title: ${title}\nAbstract: ${document.abstract.text || "(not written yet)"}`,
        messages: [{ role: "user", content: `Section: ${heading || "Untitled section"}\n\nMy notes:\n${notes.trim()}` }],
        signal: controller.signal,
        onText: setStreamed,
      });
      const result = toDraft(text);
      if (result.paragraphs.length === 0) throw new Error("The assistant returned an empty draft. Try again.");
      setDraft(result);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function insert() {
    if (!draft) return;
    insertSectionParagraphs(sectionId, draft.paragraphs, replace);
    onClose();
  }

  function close() {
    abortRef.current?.abort();
    onClose();
  }

  return (
    <div className="mb-3 rounded-md border border-line bg-surface p-3 text-sm" role="region" aria-label="Draft section from notes">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles size={14} className="text-accent" aria-hidden="true" />
        <span className="text-xs font-semibold">Draft this section from notes</span>
        <span className="flex-1" />
        <button type="button" onClick={close} aria-label="Close" className="text-muted hover:text-ink">
          <X size={14} aria-hidden="true" />
        </button>
      </div>

      {!draft && (
        <>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={5}
            placeholder={"Bullet points are fine, e.g.\n- used ESP32 with 520 KB RAM\n- quantized model to int8\n- 3x faster than float baseline"}
            className={`${inputBase} resize-y text-sm`}
            aria-label="Your notes for this section"
          />
          <p className="text-[11px] text-muted mt-1">
            The draft uses only what's in your notes. It won't add sources — cite your own references afterwards.
          </p>
        </>
      )}

      {loading && (
        <p className="mt-2 whitespace-pre-wrap leading-relaxed text-muted">
          {streamed || (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 size={13} className="animate-spin" aria-hidden="true" />
              Drafting…
            </span>
          )}
        </p>
      )}
      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}

      {draft && (
        <div className="space-y-2">
          {draft.paragraphs.map((p, i) => (
            <p key={i} className="leading-relaxed text-ink rounded bg-canvas px-2.5 py-2">
              {p.map((n) => (n.type === "text" ? n.text : "")).join("")}
            </p>
          ))}
          {(draft.removedCitations > 0 || draft.needsCitation) && (
            <ul className="space-y-1 text-xs text-amber-800 dark:text-amber-300">
              {draft.removedCitations > 0 && (
                <li className="flex gap-1.5">
                  <AlertTriangle size={12} className="flex-none mt-0.5" aria-hidden="true" />
                  Removed citation numbers the AI made up. Add real references with Cite after inserting.
                </li>
              )}
              {draft.needsCitation && (
                <li className="flex gap-1.5">
                  <AlertTriangle size={12} className="flex-none mt-0.5" aria-hidden="true" />
                  Some claims are marked [citation needed] — cite a verified reference or remove them.
                </li>
              )}
            </ul>
          )}
          {hasParagraphs && (
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} className="accent-accent" />
              Replace this section's existing paragraphs (figures, tables and subsections stay)
            </label>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 mt-3">
        {draft ? (
          <>
            <button type="button" onClick={insert} className={`${btnPrimary} text-xs py-1 px-3`}>
              Insert draft
            </button>
            <button type="button" onClick={generate} className={`${btnSecondary} text-xs py-1 px-3`}>
              Try again
            </button>
            <button type="button" onClick={() => setDraft(null)} className="text-xs text-muted hover:text-ink px-2">
              Edit notes
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={generate}
            disabled={loading || !notes.trim()}
            className={`${btnPrimary} text-xs py-1 px-3`}
          >
            {loading ? "Drafting…" : "Draft section"}
          </button>
        )}
        <span className="flex-1" />
        <span className="text-[11px] text-muted">Review and edit the draft — it's a starting point.</span>
      </div>
    </div>
  );
}
