import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertTriangle } from "lucide-react";
import { canComment, canModerate } from "../../lib/comments";
import { inlineToTokenText } from "../../lib/inlineTokens";
import {
  decideSuggestion,
  diffWords,
  isStale,
  listSuggestions,
  paragraphs,
  proposeEdit,
  readable,
  type Suggestion,
} from "../../lib/suggestions";
import type { PaperRole } from "../../lib/sharing";
import { relativeTime } from "../../lib/relativeTime";
import { friendlyErrorMessage } from "../../lib/friendlyError";
import { btnPrimary, btnSecondary, inputBase } from "../../lib/uiClasses";
import type { BodyNode, InlineNode } from "../../types/document";

interface SuggestionsListProps {
  documentId: string;
  body: BodyNode[];
  role: PaperRole | null;
  userId: string | null;
  emailOf: Map<string, string>;
  /** Present only where the paper is editable; applies accepted text to the open document. */
  onAccept?: (blockId: string, content: InlineNode[]) => void;
  onCountChange?: (count: number) => void;
}

export function SuggestionsList({ documentId, body, role, userId, emailOf, onAccept, onCountChange }: SuggestionsListProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [paragraphId, setParagraphId] = useState("");
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paras = useMemo(() => paragraphs(body), [body]);
  const byId = useMemo(() => new Map(paras.map((p) => [p.id, p])), [paras]);
  const selected = byId.get(paragraphId);
  const mayDecide = canModerate(role) && Boolean(onAccept);

  const refresh = useCallback(async () => {
    try {
      const list = await listSuggestions(documentId);
      setSuggestions(list);
      onCountChange?.(list.length);
    } catch (err) {
      setError(`Couldn't load suggestions. ${friendlyErrorMessage(err)}`);
    }
  }, [documentId, onCountChange]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await refresh();
      return true;
    } catch (err) {
      setError(friendlyErrorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  function choose(id: string) {
    setParagraphId(id);
    const p = byId.get(id);
    setDraft(p ? inlineToTokenText(p.content).text : "");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!selected || !draft.trim()) return;
    if (draft === inlineToTokenText(selected.content).text) {
      setError("Change the text before suggesting it.");
      return;
    }
    if (await run(() => proposeEdit(documentId, selected, draft, note))) {
      setParagraphId("");
      setDraft("");
      setNote("");
    }
  }

  async function accept(s: Suggestion) {
    const current = byId.get(s.blockId)?.content;
    if (!current) {
      setError("That paragraph no longer exists. Reject the suggestion instead.");
      return;
    }
    if (isStale(s, current) && !window.confirm("The paragraph changed since this was suggested. Replace it with the suggestion anyway?")) {
      return;
    }
    if (await run(() => decideSuggestion(s.id, "accepted"))) onAccept?.(s.blockId, s.proposed);
  }

  return (
    <>
      {canComment(role) && (
        <form onSubmit={submit} className="p-4 border-b border-line bg-canvas space-y-2">
          <select
            value={paragraphId}
            onChange={(e) => choose(e.target.value)}
            aria-label="Paragraph to suggest a change for"
            className={`${inputBase} text-xs py-1.5 cursor-pointer`}
          >
            <option value="">Suggest a change to a paragraph…</option>
            {paras.map((p, i) => {
              const text = readable(inlineToTokenText(p.content).text).trim();
              return (
                <option key={p.id} value={p.id}>
                  {`${i + 1}. ${text.length > 60 ? `${text.slice(0, 59)}…` : text || "(empty paragraph)"}`}
                </option>
              );
            })}
          </select>
          {selected && (
            <>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={6}
                aria-label="Suggested text"
                className={`${inputBase} text-xs resize-y`}
              />
              <p className="text-[10px] text-muted">Keep markers like ⟦C1⟧ where citations and cross-references belong.</p>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={2000}
                placeholder="Why? (optional)"
                aria-label="Note for the authors"
                className={`${inputBase} text-xs py-1.5`}
              />
              <div className="flex justify-end">
                <button type="submit" disabled={busy || !draft.trim()} className={`${btnPrimary} text-xs py-1.5 px-3`}>
                  Suggest
                </button>
              </div>
            </>
          )}
        </form>
      )}

      {error && (
        <p role="alert" className="mx-4 mt-3 text-[11px] text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {suggestions === null ? (
          <p className="text-xs text-center text-muted py-8">Loading suggestions…</p>
        ) : suggestions.length === 0 ? (
          <p className="text-xs text-center text-muted py-8">No open suggestions.</p>
        ) : (
          suggestions.map((s) => {
            const current = byId.get(s.blockId)?.content;
            const before = current ? readable(inlineToTokenText(current).text) : "";
            const after = readable(inlineToTokenText(s.proposed).text);
            const stale = isStale(s, current);
            return (
              <div key={s.id} className="rounded-xl border border-line bg-surface p-3 shadow-xs space-y-2">
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="font-medium text-ink truncate">
                    {s.authorId === userId ? "You" : s.authorId ? (emailOf.get(s.authorId) ?? "Former collaborator") : "Deleted account"}
                  </span>
                  <span className="text-muted">{relativeTime(s.createdAt)}</span>
                  {stale && (
                    <span className="ml-auto flex items-center gap-1 text-amber-700 dark:text-amber-400" title="The paragraph was edited after this suggestion was made.">
                      <AlertTriangle size={11} aria-hidden="true" />
                      {current ? "Paragraph changed" : "Paragraph removed"}
                    </span>
                  )}
                </div>
                <p className="text-xs leading-relaxed whitespace-pre-wrap break-words">
                  {diffWords(before, after).map((part, i) =>
                    part.kind === "same" ? (
                      <span key={i} className="text-ink">
                        {part.text}
                      </span>
                    ) : part.kind === "added" ? (
                      <ins key={i} className="no-underline bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200 rounded-sm">
                        {part.text}
                      </ins>
                    ) : (
                      <del key={i} className="bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 rounded-sm">
                        {part.text}
                      </del>
                    ),
                  )}
                </p>
                {s.note && <p className="text-[11px] text-muted italic">“{s.note}”</p>}
                {mayDecide && (
                  <div className="flex justify-end gap-1.5">
                    <button type="button" disabled={busy} onClick={() => run(() => decideSuggestion(s.id, "rejected"))} className={`${btnSecondary} text-[11px] py-1 px-2.5`}>
                      Reject
                    </button>
                    <button type="button" disabled={busy || !current} onClick={() => accept(s)} className={`${btnPrimary} text-[11px] py-1 px-2.5`}>
                      Accept
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
