import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Loader2, RotateCcw, Sparkles, X } from "lucide-react";
import type { InlineNode } from "../../../types/document";
import { inlineToTokenText, tokenTextToInline, type DetokenizeResult } from "../../../lib/inlineTokens";
import { wordDiff } from "../../../lib/wordDiff";
import { streamAi } from "../../../lib/aiClient";
import { btnPrimary, btnSecondary } from "../../../lib/uiClasses";
import { PARAGRAPH_AI_ACTIONS, type ParagraphAiAction } from "../../../lib/paragraphAiActions";

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

export function ParagraphAiPanel({
  action,
  content,
  context,
  labelFor,
  onAccept,
  onClose,
}: {
  action: ParagraphAiAction;
  content: InlineNode[];
  /** Paper title and section heading, to keep terminology consistent. */
  context: string;
  labelFor: (node: InlineNode) => string;
  onAccept: (content: InlineNode[]) => void;
  onClose: () => void;
}) {
  const spec = PARAGRAPH_AI_ACTIONS.find((a) => a.id === action) ?? PARAGRAPH_AI_ACTIONS[0];
  const tokenized = useMemo(() => inlineToTokenText(content), [content]);
  const [attempt, setAttempt] = useState(0);
  const [streamed, setStreamed] = useState("");
  const [result, setResult] = useState<DetokenizeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setStreamed("");
    setResult(null);
    setError(null);
    streamAi({
      task: "edit",
      documentContext: context,
      messages: [{ role: "user", content: `${spec.instruction}\n\nParagraph:\n${tokenized.text}` }],
      signal: controller.signal,
      onText: setStreamed,
    })
      .then((text) => {
        if (!text) throw new Error("The assistant returned an empty response. Try again.");
        setResult(tokenTextToInline(text, tokenized.tokens));
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Something went wrong.");
      });
    return () => controller.abort();
    // `content` is captured once per attempt on purpose: edits made while the
    // panel is open should not restart the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, action]);

  const display = (nodes: InlineNode[]) => nodes.map((n) => (n.type === "text" ? n.text : labelFor(n))).join("");
  const diff = useMemo(
    () => (result ? wordDiff(display(content), display(result.content)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [result],
  );
  const removedCitations = result ? result.invented.length + result.strayCitations.length : 0;

  return (
    <div className="border-t border-line bg-canvas px-3 py-2.5 text-sm" role="region" aria-label={`AI suggestion: ${spec.label}`}>
      <div className="flex items-center gap-2 mb-2">
        <Sparkles size={14} className="text-accent" aria-hidden="true" />
        <span className="text-xs font-semibold text-ink">{spec.label}</span>
        {!result && !error && <Loader2 size={13} className="animate-spin text-muted" aria-label="Working" />}
        <span className="flex-1" />
        <button type="button" onClick={onClose} aria-label="Discard suggestion" className="text-muted hover:text-ink">
          <X size={14} aria-hidden="true" />
        </button>
      </div>

      {error ? (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : result ? (
        <p className="leading-relaxed text-ink whitespace-pre-wrap">
          {diff.map((part, i) =>
            part.type === "same" ? (
              <span key={i}>{part.text}</span>
            ) : part.type === "add" ? (
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
      ) : (
        <p className="leading-relaxed text-muted whitespace-pre-wrap">{streamed.replace(/⟦[CX]\d+⟧/g, "[…]") || "Thinking…"}</p>
      )}

      {result && (removedCitations > 0 || result.missing.length > 0 || tokenized.hadFormatting || /\[citation needed\]/i.test(display(result.content))) && (
        <ul className="mt-2 space-y-1 text-xs text-amber-800 dark:text-amber-300">
          {removedCitations > 0 && (
            <li className="flex gap-1.5">
              <AlertTriangle size={12} className="flex-none mt-0.5" aria-hidden="true" />
              Removed {plural(removedCitations, "citation")} the AI tried to add. Only references you add yourself are cited.
            </li>
          )}
          {result.missing.length > 0 && (
            <li className="flex gap-1.5">
              <AlertTriangle size={12} className="flex-none mt-0.5" aria-hidden="true" />
              {plural(result.missing.length, "citation")} the AI dropped {result.missing.length === 1 ? "was" : "were"} put back at the end — move
              {result.missing.length === 1 ? " it" : " them"} if needed.
            </li>
          )}
          {/\[citation needed\]/i.test(display(result.content)) && (
            <li className="flex gap-1.5">
              <AlertTriangle size={12} className="flex-none mt-0.5" aria-hidden="true" />
              The suggestion marks a claim with [citation needed] — replace it with a verified reference or remove the claim.
            </li>
          )}
          {tokenized.hadFormatting && (
            <li className="flex gap-1.5">
              <AlertTriangle size={12} className="flex-none mt-0.5" aria-hidden="true" />
              Bold and italic formatting in this paragraph will not be kept.
            </li>
          )}
        </ul>
      )}

      <div className="flex items-center gap-2 mt-3">
        <button
          type="button"
          onClick={() => result && onAccept(result.content)}
          disabled={!result}
          className={`${btnPrimary} text-xs py-1 px-3`}
        >
          <Check size={13} aria-hidden="true" />
          Accept
        </button>
        <button type="button" onClick={() => setAttempt((n) => n + 1)} className={`${btnSecondary} text-xs py-1 px-3`}>
          <RotateCcw size={13} aria-hidden="true" />
          Try again
        </button>
        <button type="button" onClick={onClose} className="text-xs text-muted hover:text-ink px-2">
          Discard
        </button>
        <span className="flex-1" />
        <span className="text-[11px] text-muted">Review before accepting — AI can make mistakes.</span>
      </div>
    </div>
  );
}
