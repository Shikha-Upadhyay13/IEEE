import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight, ClipboardCheck, XCircle } from "lucide-react";
import { useDocumentStore } from "../../store/documentStore";
import { checklistSummary, runChecklist, type ChecklistItem, type ChecklistStatus } from "../../lib/checklist";
import type { BodyNode } from "../../types/document";
import { Popover } from "../ui/Popover";
import { btnSecondary } from "../../lib/uiClasses";
import type { EditorView } from "./EditorPanel";

const STATUS_ICON: Record<ChecklistStatus, { icon: typeof CheckCircle2; className: string; label: string }> = {
  pass: { icon: CheckCircle2, className: "text-emerald-600 dark:text-emerald-400", label: "Passed" },
  warn: { icon: AlertTriangle, className: "text-amber-600 dark:text-amber-400", label: "Warning" },
  fail: { icon: XCircle, className: "text-red-600 dark:text-red-400", label: "Needs fixing" },
};

const STATUS_ORDER: Record<ChecklistStatus, number> = { fail: 0, warn: 1, pass: 2 };

function nearestSectionId(nodes: BodyNode[], blockId: string, enclosing: string | null = null): string | null | undefined {
  for (const node of nodes) {
    if (node.id === blockId) return node.type === "section" ? node.id : enclosing;
    if (node.type === "section") {
      const found = nearestSectionId(node.children, blockId, node.id);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

export function ChecklistPanel({
  pageCount,
  onNavigate,
}: {
  pageCount: number | null;
  onNavigate: (view: EditorView, blockId?: string) => void;
}) {
  const document = useDocumentStore((s) => s.document);
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  const items = useMemo(
    () => [...runChecklist(document, pageCount)].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]),
    [document, pageCount],
  );
  const summary = checklistSummary(items);
  const outstanding = summary.fail + summary.warn;

  function go(item: ChecklistItem) {
    const target = item.target;
    if (!target) return;
    setOpen(false);
    if (target.kind === "block") {
      const sectionId = nearestSectionId(document.body, target.id);
      onNavigate(sectionId ? { kind: "section", id: sectionId } : { kind: "all" }, target.id);
    } else {
      onNavigate({ kind: target.kind });
    }
  }

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`${btnSecondary} text-xs py-1.5 px-3 flex items-center gap-1.5`}
        title="Submission checklist"
      >
        <ClipboardCheck size={14} aria-hidden="true" />
        <span>Checklist</span>
        {outstanding > 0 ? (
          <span
            className={`ml-0.5 rounded-full px-1.5 text-[10px] font-semibold leading-4 ${
              summary.fail > 0
                ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
            }`}
          >
            {outstanding}
          </span>
        ) : (
          <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400" aria-label="All checks pass" />
        )}
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} align="end" width={360} labelledBy="checklist-heading">
        <div className="px-4 pt-3 pb-2 border-b border-line">
          <h2 id="checklist-heading" className="text-sm font-semibold">
            Submission checklist
          </h2>
          <p className="text-xs text-muted mt-0.5">
            {outstanding === 0
              ? "Everything we can check looks ready."
              : `${summary.fail} to fix, ${summary.warn} to review. Click an item to jump to it.`}
          </p>
        </div>
        <ul className="py-1">
          {items.map((item) => {
            const status = STATUS_ICON[item.status];
            const Icon = status.icon;
            const clickable = item.target !== undefined && item.status !== "pass";
            const content = (
              <>
                <Icon size={16} className={`flex-none mt-0.5 ${status.className}`} aria-label={status.label} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{item.label}</span>
                  <span className="block text-xs text-muted mt-0.5 break-words">{item.detail}</span>
                </span>
                {clickable && <ChevronRight size={14} className="flex-none mt-1 text-muted" aria-hidden="true" />}
              </>
            );
            return (
              <li key={item.id}>
                {clickable ? (
                  <button
                    type="button"
                    onClick={() => go(item)}
                    className="w-full flex items-start gap-3 px-4 py-2.5 text-left hover:bg-canvas focus-visible:bg-canvas outline-none"
                  >
                    {content}
                  </button>
                ) : (
                  <div className="flex items-start gap-3 px-4 py-2.5">{content}</div>
                )}
              </li>
            );
          })}
        </ul>
        <p className="px-4 py-2.5 border-t border-line text-[11px] text-muted leading-relaxed">
          These checks cover formatting and completeness. Always read your venue's call for papers for its own rules.
        </p>
      </Popover>
    </>
  );
}
