import { useEffect, useRef, useState } from "react";
import { ChevronRight, Loader2, MessageSquareText, RotateCcw, X } from "lucide-react";
import { useDocumentStore } from "../../store/documentStore";
import { streamAi } from "../../lib/aiClient";
import { buildReviewContext, findSectionForNote, parseReview, type Review } from "../../lib/review";
import { btnPrimary, btnSecondary } from "../../lib/uiClasses";
import type { EditorView } from "./EditorPanel";

const KIND_LABEL: Record<Review["notes"][number]["kind"], string> = {
  clarity: "Clarity",
  structure: "Structure",
  presentation: "Presentation",
};

export function ReviewPanel({ onClose, onNavigate }: { onClose: () => void; onNavigate: (view: EditorView) => void }) {
  const document = useDocumentStore((s) => s.document);
  const [review, setReview] = useState<Review | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      abortRef.current?.abort();
    };
  }, [onClose]);

  async function run() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    setReview(null);
    try {
      const text = await streamAi({
        task: "review",
        messages: [{ role: "user", content: `Review the writing of this paper draft:\n\n${buildReviewContext(document)}` }],
        signal: controller.signal,
      });
      const parsed = parseReview(text);
      if (!parsed) throw new Error("The reviewer's response couldn't be read. Try again.");
      setReview(parsed);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function targetFor(section: string): EditorView | null {
    const key = section.trim().toLowerCase();
    if (key === "title" || key === "abstract" || key === "keywords") return { kind: "details" };
    const id = findSectionForNote(document.body, section);
    return id ? { kind: "section", id } : null;
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-title"
        className="h-full w-full max-w-md bg-surface border-l border-line shadow-2xl flex flex-col"
      >
        <div className="flex items-center gap-2 px-5 py-4 border-b border-line">
          <MessageSquareText size={16} className="text-accent" aria-hidden="true" />
          <h2 id="review-title" className="text-sm font-semibold">
            Writing feedback
          </h2>
          <span className="flex-1" />
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-ink">
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!review && !loading && !error && (
            <div className="text-sm text-muted space-y-3">
              <p>
                Get reviewer-style notes on the clarity, structure and presentation of your draft — undefined terms,
                missing transitions, an abstract that skips the results, figures never discussed.
              </p>
              <p>
                It does not check whether your claims, numbers or methods are correct. That judgement stays with you
                and your supervisor.
              </p>
              <button type="button" onClick={run} className={`${btnPrimary} text-sm`}>
                Review my draft
              </button>
            </div>
          )}

          {loading && (
            <p className="flex items-center gap-2 text-sm text-muted">
              <Loader2 size={15} className="animate-spin" aria-hidden="true" />
              Reading your paper…
            </p>
          )}

          {error && (
            <div className="space-y-3">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              <button type="button" onClick={run} className={`${btnSecondary} text-sm`}>
                Try again
              </button>
            </div>
          )}

          {review && (
            <div className="space-y-4">
              {review.summary && <p className="text-sm leading-relaxed">{review.summary}</p>}
              <ol className="space-y-2">
                {review.notes.map((note, i) => {
                  const target = targetFor(note.section);
                  const body = (
                    <>
                      <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
                        {KIND_LABEL[note.kind]}
                        {note.section && <span className="normal-case tracking-normal font-medium">· {note.section}</span>}
                      </span>
                      <span className="block text-sm text-ink mt-0.5 leading-relaxed">{note.comment}</span>
                    </>
                  );
                  return (
                    <li key={i}>
                      {target ? (
                        <button
                          type="button"
                          onClick={() => {
                            onNavigate(target);
                            onClose();
                          }}
                          className="w-full flex items-start gap-2 rounded-md border border-line px-3 py-2.5 text-left hover:bg-canvas"
                        >
                          <span className="min-w-0 flex-1">{body}</span>
                          <ChevronRight size={14} className="flex-none mt-1 text-muted" aria-hidden="true" />
                        </button>
                      ) : (
                        <div className="rounded-md border border-line px-3 py-2.5">{body}</div>
                      )}
                    </li>
                  );
                })}
              </ol>
              <button type="button" onClick={run} className={`${btnSecondary} text-xs py-1.5 px-3`}>
                <RotateCcw size={13} aria-hidden="true" />
                Review again
              </button>
            </div>
          )}
        </div>

        <p className="px-5 py-3 border-t border-line text-[11px] text-muted leading-relaxed">
          AI feedback on writing only. It can miss things or be wrong — treat each note as a suggestion.
        </p>
      </aside>
    </div>
  );
}
