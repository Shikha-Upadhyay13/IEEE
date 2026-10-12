import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, MessageSquare, RotateCcw, Trash2, X } from "lucide-react";
import {
  addComment,
  canComment,
  canModerate,
  commentAnchors,
  deleteComment,
  findMentions,
  groupThreads,
  listComments,
  setResolved,
  type Comment,
  type Thread,
} from "../../lib/comments";
import { listPeople, type PaperRole, type Person } from "../../lib/sharing";
import { relativeTime } from "../../lib/relativeTime";
import { friendlyErrorMessage } from "../../lib/friendlyError";
import { btnPrimary, btnSecondary, inputBase } from "../../lib/uiClasses";
import type { BodyNode, InlineNode } from "../../types/document";
import { SuggestionsList } from "./SuggestionsList";
import { PaperNotifyLevel } from "./PaperNotifyLevel";

const REFRESH_MS = 30_000;

interface CommentsPanelProps {
  documentId: string;
  body: BodyNode[];
  role: PaperRole | null;
  userId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (blockId: string) => void;
  onAcceptSuggestion?: (blockId: string, content: InlineNode[]) => void;
}

export function CommentsPanel({ documentId, body, role, userId, isOpen, onClose, onNavigate, onAcceptSuggestion }: CommentsPanelProps) {
  const [tab, setTab] = useState<"comments" | "suggestions">("comments");
  const [suggestionCount, setSuggestionCount] = useState<number | null>(null);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [filter, setFilter] = useState<"open" | "resolved">("open");
  const [anchor, setAnchor] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const anchors = useMemo(() => commentAnchors(body), [body]);
  const anchorLabel = useMemo(() => new Map(anchors.map((a) => [a.id, a.label])), [anchors]);
  const emailOf = useMemo(() => new Map(people.map((p) => [p.userId, p.email])), [people]);
  const threads = useMemo(() => groupThreads(comments ?? []), [comments]);
  const visible = threads.filter((t) => (filter === "open" ? !t.root.resolvedAt : t.root.resolvedAt));
  const openCount = threads.filter((t) => !t.root.resolvedAt).length;
  const mayComment = canComment(role);

  const refresh = useCallback(async () => {
    try {
      setComments(await listComments(documentId));
    } catch (err) {
      setError(`Couldn't load comments. ${friendlyErrorMessage(err)}`);
    }
  }, [documentId]);

  useEffect(() => {
    if (!isOpen) return;
    void refresh();
    listPeople(documentId)
      .then(setPeople)
      .catch((err) => console.warn("Couldn't load people for comments:", err));
    const timer = window.setInterval(() => void refresh(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [isOpen, documentId, refresh]);

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

  async function post(e: { preventDefault: () => void }) {
    e.preventDefault();
    if (!draft.trim()) return;
    const ok = await run(() => addComment(documentId, { body: draft, blockId: anchor || null, mentions: findMentions(draft, people) }));
    if (ok) {
      setDraft("");
      setFilter("open");
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs animate-in fade-in duration-150" onClick={onClose}>
      <div
        role="dialog"
        aria-labelledby="comments-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-surface border-l border-line h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <div className="flex items-center gap-2">
            <MessageSquare size={18} className="text-muted" aria-hidden="true" />
            <h2 id="comments-title" className="text-base font-semibold text-ink">
              Feedback
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close comments"
            className="p-1 rounded-md text-muted hover:text-ink hover:bg-canvas transition-colors"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div role="tablist" aria-label="Feedback type" className="grid grid-cols-2 border-b border-line text-xs">
          {(["comments", "suggestions"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`py-2 border-b-2 -mb-px ${tab === t ? "border-accent text-accent font-medium" : "border-transparent text-muted hover:text-ink"}`}
            >
              {t === "comments" ? `Comments (${openCount})` : `Suggested edits${suggestionCount !== null ? ` (${suggestionCount})` : ""}`}
            </button>
          ))}
        </div>

        {tab === "suggestions" ? (
          <SuggestionsList
            documentId={documentId}
            body={body}
            role={role}
            userId={userId}
            emailOf={emailOf}
            onAccept={onAcceptSuggestion}
            onCountChange={setSuggestionCount}
          />
        ) : (
          <>
            {mayComment && (
              <form onSubmit={post} className="p-4 border-b border-line bg-canvas space-y-2">
                <select
                  value={anchor}
                  onChange={(e) => setAnchor(e.target.value)}
                  aria-label="What this comment is about"
                  className={`${inputBase} text-xs py-1.5 cursor-pointer`}
                >
                  <option value="">The whole paper</option>
                  {anchors.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={3}
                  maxLength={10000}
                  placeholder="Add a comment. Type @name to mention a co-author."
                  aria-label="New comment"
                  className={`${inputBase} text-xs resize-y`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) post(e);
                  }}
                />
                <div className="flex justify-end">
                  <button type="submit" disabled={busy || !draft.trim()} className={`${btnPrimary} text-xs py-1.5 px-3`}>
                    Comment
                  </button>
                </div>
              </form>
            )}

            <div role="tablist" aria-label="Comment filter" className="flex gap-1 px-4 pt-3 border-b border-line">
              {(["open", "resolved"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  role="tab"
                  aria-selected={filter === f}
                  onClick={() => setFilter(f)}
                  className={`px-2.5 py-1.5 text-xs border-b-2 -mb-px ${
                    filter === f ? "border-accent text-accent font-medium" : "border-transparent text-muted hover:text-ink"
                  }`}
                >
                  {f === "open" ? `Open (${openCount})` : `Resolved (${threads.length - openCount})`}
                </button>
              ))}
            </div>

            {error && (
              <p role="alert" className="mx-4 mt-3 text-[11px] text-red-600 dark:text-red-400">
                {error}
              </p>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {comments === null ? (
                <p className="text-xs text-center text-muted py-8">Loading comments…</p>
              ) : visible.length === 0 ? (
                <p className="text-xs text-center text-muted py-8">
                  {filter === "open"
                    ? mayComment
                      ? "No open comments. Start a thread above."
                      : "No open comments."
                    : "No resolved threads yet."}
                </p>
              ) : (
                visible.map((thread) => (
                  <ThreadCard
                    key={thread.root.id}
                    thread={thread}
                    anchorLabel={
                      thread.root.blockId ? (anchorLabel.get(thread.root.blockId) ?? "A removed part of the paper") : "The whole paper"
                    }
                    anchorExists={!thread.root.blockId || anchorLabel.has(thread.root.blockId)}
                    emailOf={emailOf}
                    userId={userId}
                    role={role}
                    busy={busy}
                    onNavigate={onNavigate}
                    onReply={(text) =>
                      run(() =>
                        addComment(documentId, {
                          body: text,
                          blockId: thread.root.blockId,
                          parentId: thread.root.id,
                          mentions: findMentions(text, people),
                        }),
                      )
                    }
                    onResolve={(resolved) => run(() => setResolved(thread.root.id, resolved))}
                    onDelete={(id) => run(() => deleteComment(id))}
                  />
                ))
              )}
            </div>
          </>
        )}
        {userId && <PaperNotifyLevel documentId={documentId} userId={userId} />}
      </div>
    </div>
  );
}

function ThreadCard({
  thread,
  anchorLabel,
  anchorExists,
  emailOf,
  userId,
  role,
  busy,
  onNavigate,
  onReply,
  onResolve,
  onDelete,
}: {
  thread: Thread;
  anchorLabel: string;
  anchorExists: boolean;
  emailOf: Map<string, string>;
  userId: string | null;
  role: PaperRole | null;
  busy: boolean;
  onNavigate?: (blockId: string) => void;
  onReply: (text: string) => Promise<boolean>;
  onResolve: (resolved: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const [reply, setReply] = useState("");
  const { root } = thread;
  const mayResolve = canModerate(role) || (userId !== null && root.authorId === userId);

  async function submitReply(e: FormEvent) {
    e.preventDefault();
    if (reply.trim() && (await onReply(reply))) setReply("");
  }

  return (
    <div className={`rounded-xl border border-line bg-surface p-3 shadow-xs ${root.resolvedAt ? "opacity-75" : ""}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        {root.blockId && anchorExists && onNavigate ? (
          <button
            type="button"
            onClick={() => onNavigate(root.blockId!)}
            className="min-w-0 text-left text-[11px] text-accent hover:underline truncate"
          >
            {anchorLabel}
          </button>
        ) : (
          <span className="min-w-0 text-[11px] text-muted truncate">{anchorLabel}</span>
        )}
        {mayResolve && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onResolve(!root.resolvedAt)}
            className={`${btnSecondary} text-[11px] py-0.5 px-2 flex-none flex items-center gap-1`}
          >
            {root.resolvedAt ? <RotateCcw size={12} aria-hidden="true" /> : <Check size={12} aria-hidden="true" />}
            {root.resolvedAt ? "Reopen" : "Resolve"}
          </button>
        )}
      </div>

      {[root, ...thread.replies].map((c) => (
        <CommentItem
          key={c.id}
          comment={c}
          author={c.authorId ? (emailOf.get(c.authorId) ?? "Former collaborator") : "Deleted account"}
          mine={c.authorId === userId}
          mayDelete={c.authorId === userId || role === "owner"}
          busy={busy}
          onDelete={() => onDelete(c.id)}
        />
      ))}

      {canComment(role) && !root.resolvedAt && (
        <form onSubmit={submitReply} className="mt-2 flex gap-1.5">
          <input
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            maxLength={10000}
            placeholder="Reply…"
            aria-label="Reply to this thread"
            className={`${inputBase} text-xs py-1.5 min-w-0 flex-1`}
          />
          <button type="submit" disabled={busy || !reply.trim()} className={`${btnPrimary} text-xs py-1.5 px-2.5 flex-none`}>
            Reply
          </button>
        </form>
      )}
    </div>
  );
}

function CommentItem({
  comment,
  author,
  mine,
  mayDelete,
  busy,
  onDelete,
}: {
  comment: Comment;
  author: string;
  mine: boolean;
  mayDelete: boolean;
  busy: boolean;
  onDelete: () => void;
}) {
  return (
    <div className={`group py-1.5 ${comment.parentId ? "pl-3 border-l-2 border-line ml-1" : ""}`}>
      <div className="flex items-center gap-1.5 text-[11px]">
        <span className="font-medium text-ink truncate">{mine ? "You" : author}</span>
        <span className="text-muted flex-none">{relativeTime(comment.createdAt)}</span>
        {mayDelete && (
          <button
            type="button"
            disabled={busy}
            onClick={onDelete}
            aria-label="Delete comment"
            className="ml-auto text-muted hover:text-red-600 opacity-0 group-hover:opacity-100 focus:opacity-100"
          >
            <Trash2 size={12} aria-hidden="true" />
          </button>
        )}
      </div>
      <p className="text-xs text-ink whitespace-pre-wrap break-words mt-0.5">{comment.body}</p>
    </div>
  );
}
