import { useState, type ReactNode } from "react";
import { AlertTriangle, Lock } from "lucide-react";
import { useDocumentStore } from "../../store/documentStore";
import { FORMAT_LIST, type FormatId } from "../../lib/formats/formats";
import { MODES, getMode, isAllowed, lockReason, type ModeControlled, type StyleMode } from "../../lib/formats/modes";
import { createSnapshot } from "../../lib/versions";
import { friendlyErrorMessage } from "../../lib/friendlyError";
import { useConfirm } from "../ConfirmDialog";
import { CopyrightNoticeFields } from "./CopyrightNoticeFields";
import { inputBase, labelBase } from "../../lib/uiClasses";
import type { FontFamily } from "../../types/document";

const FONT_OPTIONS: { value: FontFamily; label: string }[] = [
  { value: "times", label: "Times New Roman (IEEE)" },
  { value: "arial", label: "Arial" },
  { value: "helvetica", label: "Helvetica" },
  { value: "georgia", label: "Georgia" },
  { value: "calibri", label: "Calibri" },
];

/** Explains why a control is unavailable in the current mode. */
export function LockNote({ property }: { property: ModeControlled }) {
  return (
    <p className="flex items-start gap-1.5 text-xs text-muted mt-1.5">
      <Lock size={12} aria-hidden="true" className="flex-none mt-0.5" />
      <span>{lockReason(property)}</span>
    </p>
  );
}

function Field({ children, className = "mt-4" }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

export function FormatPanel() {
  const meta = useDocumentStore((s) => s.document.meta);
  const document = useDocumentStore((s) => s.document);
  const documentId = useDocumentStore((s) => s.documentId);
  const setFormat = useDocumentStore((s) => s.setFormat);
  const setMode = useDocumentStore((s) => s.setMode);
  const setFontFamily = useDocumentStore((s) => s.setFontFamily);
  const setPaperSize = useDocumentStore((s) => s.setPaperSize);
  const setShowPageNumbers = useDocumentStore((s) => s.setShowPageNumbers);
  const setDraftWatermark = useDocumentStore((s) => s.setDraftWatermark);
  const { confirm, ConfirmDialog } = useConfirm();
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  const mode = getMode(meta);
  const currentFormat = FORMAT_LIST.find((f) => f.id === meta.template) ?? FORMAT_LIST[0];

  async function handleFormatChange(next: FormatId) {
    if (next === meta.template) return;
    const target = FORMAT_LIST.find((f) => f.id === next);
    const ok = await confirm({
      title: `Switch to ${target?.label ?? next}?`,
      message:
        "Your text stays the same; layout and pagination will change. A snapshot of the current version is saved to Version history first, so you can switch back.",
      confirmLabel: "Switch format",
      danger: false,
    });
    if (!ok) return;
    setSwitchError(null);
    setSwitching(true);
    if (documentId) {
      const { error } = await createSnapshot(documentId, `Before switching to ${target?.label ?? next}`, document);
      if (error) {
        setSwitching(false);
        setSwitchError(`Couldn't save a snapshot, so the format wasn't changed. ${friendlyErrorMessage(error)}`);
        return;
      }
    }
    setFormat(next);
    setSwitching(false);
  }

  return (
    <div className="mt-6 pt-5 border-t border-line">
      {ConfirmDialog}
      <h3 className="text-sm font-semibold text-ink mb-3">Format &amp; style</h3>

      <Field className="">
        <label htmlFor="paper-format" className={labelBase}>
          Format
        </label>
        <select
          id="paper-format"
          value={meta.template}
          disabled={switching}
          onChange={(e) => handleFormatChange(e.target.value as FormatId)}
          className={`${inputBase} cursor-pointer`}
        >
          {FORMAT_LIST.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted mt-1.5">{currentFormat.description}</p>
        {switchError && (
          <p role="alert" className="text-xs text-red-600 dark:text-red-400 mt-1.5">
            {switchError}
          </p>
        )}
      </Field>

      <Field>
        <span id="paper-mode-label" className={labelBase}>
          Mode
        </span>
        <div role="radiogroup" aria-labelledby="paper-mode-label" className="inline-flex rounded-md border border-line overflow-hidden">
          {MODES.map((m, i) => {
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setMode(m.id as StyleMode)}
                className={`px-3 py-1.5 text-sm transition-colors ${i > 0 ? "border-l border-line" : ""} ${
                  active ? "bg-accent text-accent-fg font-medium" : "bg-surface text-muted hover:bg-canvas"
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted mt-1.5">{MODES.find((m) => m.id === mode)?.summary}</p>
        {mode === "custom" && (
          <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-500 mt-2">
            <AlertTriangle size={13} aria-hidden="true" className="flex-none mt-0.5" />
            <span>This paper is not IEEE-compliant while in Custom mode.</span>
          </p>
        )}
      </Field>

      <Field>
        <label htmlFor="paper-size" className={labelBase}>
          Paper size
        </label>
        <select
          id="paper-size"
          value={meta.paperSize}
          onChange={(e) => setPaperSize(e.target.value as "letter" | "a4")}
          className={`${inputBase} cursor-pointer`}
        >
          <option value="letter">US Letter (8.5 × 11 in)</option>
          <option value="a4">A4 (210 × 297 mm)</option>
        </select>
        <p className="text-xs text-muted mt-1.5">
          Both are official IEEE sizes — Letter for US/Canada, A4 for most other regions.
        </p>
      </Field>

      <Field>
        <label htmlFor="paper-font" className={labelBase}>
          Font
        </label>
        <select
          id="paper-font"
          value={isAllowed("fontFamily", mode) ? (meta.fontFamily ?? "times") : "times"}
          disabled={!isAllowed("fontFamily", mode)}
          onChange={(e) => setFontFamily(e.target.value as FontFamily)}
          className={`${inputBase} cursor-pointer disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {FONT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {!isAllowed("fontFamily", mode) && <LockNote property="fontFamily" />}
      </Field>

      <Field className="mt-4 flex flex-col gap-3">
        <label className="flex items-start gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={isAllowed("showPageNumbers", mode) && (meta.showPageNumbers ?? false)}
            disabled={!isAllowed("showPageNumbers", mode)}
            onChange={(e) => setShowPageNumbers(e.target.checked)}
            className="mt-0.5 flex-none"
          />
          <span>
            Show page numbers
            {isAllowed("showPageNumbers", mode) ? (
              <span className="block text-xs text-muted mt-0.5">
                Useful for review copies; most conferences add page numbers themselves.
              </span>
            ) : (
              <LockNote property="showPageNumbers" />
            )}
          </span>
        </label>

        {mode === "draft" && (
          <label className="flex items-start gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={meta.draftWatermark ?? false}
              onChange={(e) => setDraftWatermark(e.target.checked)}
              className="mt-0.5 flex-none"
            />
            <span>
              Mark pages “DRAFT — not for submission”
              <span className="block text-xs text-muted mt-0.5">Printed in the top margin of every page.</span>
            </span>
          </label>
        )}
      </Field>

      {meta.template === "ieee-conference" && <CopyrightNoticeFields />}
    </div>
  );
}
