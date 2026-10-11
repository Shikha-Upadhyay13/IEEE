import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight, ClipboardCheck, FileDown, Info, XCircle } from "lucide-react";
import { useDocumentStore } from "../../store/documentStore";
import {
  STATUS_LABEL,
  checklistSummary,
  type ChecklistFix,
  type ChecklistItem,
  type ChecklistStatus,
} from "../../lib/checklist";
import { downloadText, readinessReport } from "../../lib/readinessReport";
import { extractTitleText } from "../../lib/extractTitleText";
import type { BodyNode } from "../../types/document";
import { Popover } from "../ui/Popover";
import { btnSecondary } from "../../lib/uiClasses";
import type { EditorView } from "./EditorPanel";

const STATUS_ICON: Record<ChecklistStatus, { icon: typeof CheckCircle2; className: string }> = {
  pass: { icon: CheckCircle2, className: "text-emerald-600 dark:text-emerald-400" },
  info: { icon: Info, className: "text-sky-600 dark:text-sky-400" },
  warn: { icon: AlertTriangle, className: "text-amber-600 dark:text-amber-400" },
  fail: { icon: XCircle, className: "text-red-600 dark:text-red-400" },
};

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
  items,
  onNavigate,
}: {
  items: ChecklistItem[];
  onNavigate: (view: EditorView, blockId?: string) => void;
}) {
  const document = useDocumentStore((s) => s.document);
  const fixReferencePageRanges = useDocumentStore((s) => s.fixReferencePageRanges);
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  const summary = checklistSummary(items);
  const outstanding = summary.fail + summary.warn;

  function downloadReport() {
    const title = extractTitleText(document);
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "paper";
    downloadText(`${slug}-readiness.txt`, readinessReport(document, title, items));
  }

  function applyFix(fix: ChecklistFix) {
    if (fix.id === "page-range-dashes") fixReferencePageRanges();
  }

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
              : `${summary.fail} ${summary.fail === 1 ? "blocker" : "blockers"}, ${summary.warn} ${
                  summary.warn === 1 ? "warning" : "warnings"
                }. Click an item to jump to it.`}
          </p>
        </div>
        <ul className="py-1">
          {items.map((item) => {
            const status = STATUS_ICON[item.status];
            const Icon = status.icon;
            const clickable = item.target !== undefined && item.status !== "pass";
            const content = (
              <>
                <Icon size={16} className={`flex-none mt-0.5 ${status.className}`} aria-label={STATUS_LABEL[item.status]} />
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
                {item.fix && (
                  <div className="pl-11 pr-4 pb-2.5 -mt-1">
                    <button
                      type="button"
                      onClick={() => item.fix && applyFix(item.fix)}
                      className={`${btnSecondary} text-xs py-1 px-2.5`}
                    >
                      {item.fix.label}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <div className="px-4 py-2.5 border-t border-line">
          <button
            type="button"
            onClick={downloadReport}
            className="flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
          >
            <FileDown size={13} aria-hidden="true" />
            Download readiness report
          </button>
          <p className="text-[11px] text-muted leading-relaxed mt-1.5">
            These checks cover formatting and completeness. Always read your venue's call for papers for its own rules.
          </p>
        </div>
      </Popover>
    </>
  );
}
