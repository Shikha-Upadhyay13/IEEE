import { useEffect, useRef, useState, type ClipboardEvent } from "react";
import { ClipboardPaste, X } from "lucide-react";
import { useDocumentStore } from "../../store/documentStore";
import { blocksToImport, htmlToBlocks, textToBlocks, type PasteImport } from "../../lib/pasteImport";
import { btnPrimary, btnSecondary } from "../../lib/uiClasses";
import { extractTitleText } from "../../lib/extractTitleText";

const PLACEHOLDER_TITLES = new Set(["", "untitled paper"]);

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

export function PasteImportDialog({ onClose }: { onClose: () => void }) {
  const document = useDocumentStore((s) => s.document);
  const importBody = useDocumentStore((s) => s.importBody);
  const setTitle = useDocumentStore((s) => s.setTitle);
  const setAbstract = useDocumentStore((s) => s.setAbstract);
  const setKeywords = useDocumentStore((s) => s.setKeywords);

  const [parsed, setParsed] = useState<PasteImport | null>(null);
  const [mode, setMode] = useState<"replace" | "append">("replace");
  const [fillDetails, setFillDetails] = useState(true);
  const pasteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    pasteRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handlePaste(e: ClipboardEvent<HTMLDivElement>) {
    e.preventDefault();
    const html = e.clipboardData.getData("text/html");
    const text = e.clipboardData.getData("text/plain");
    const blocks = html ? htmlToBlocks(html) : textToBlocks(text);
    const result = blocksToImport(blocks.length > 0 ? blocks : textToBlocks(text));
    setParsed(result);
  }

  const detailsFound = parsed ? Boolean(parsed.title || parsed.abstract || parsed.keywords.length) : false;

  function apply() {
    if (!parsed) return;
    importBody(parsed.body, mode);
    if (fillDetails) {
      if (parsed.title && PLACEHOLDER_TITLES.has(extractTitleText(document).trim().toLowerCase())) setTitle(parsed.title);
      if (parsed.abstract && !document.abstract.text.trim()) setAbstract(parsed.abstract);
      if (parsed.keywords.length && document.keywords.length === 0) setKeywords(parsed.keywords.join(", "));
    }
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="paste-import-title"
    >
      <div className="bg-surface border border-line rounded-2xl shadow-2xl max-w-lg w-full p-6">
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <h3 id="paste-import-title" className="text-sm font-semibold text-ink">
            Import from Word or Google Docs
          </h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-ink">
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <p className="text-xs text-muted mt-3 mb-2">
          Copy your draft (Ctrl+A, Ctrl+C) and paste it below. Headings become sections; numbering like "II." or
          "3.1" is removed because the template numbers sections for you.
        </p>

        <div
          ref={pasteRef}
          contentEditable
          suppressContentEditableWarning
          onPaste={handlePaste}
          onKeyDown={(e) => {
            if (!(e.ctrlKey || e.metaKey) && e.key.length === 1) e.preventDefault();
          }}
          role="textbox"
          aria-label="Paste your document here"
          tabIndex={0}
          className="flex min-h-28 items-center justify-center gap-2 rounded-lg border-2 border-dashed border-line bg-canvas px-4 py-6 text-sm text-muted outline-none focus:border-accent"
        >
          <ClipboardPaste size={16} aria-hidden="true" />
          {parsed ? "Paste again to replace" : "Click here and paste (Ctrl+V)"}
        </div>

        {parsed && (
          <div className="mt-4 rounded-lg border border-line p-3 text-sm">
            {parsed.sectionCount === 0 && parsed.paragraphCount === 0 ? (
              <p className="text-muted">Nothing to import was found in what you pasted.</p>
            ) : (
              <>
                <p className="font-medium text-ink">
                  Found {plural(parsed.sectionCount, "section")} and {plural(parsed.paragraphCount, "paragraph")}.
                </p>
                <ul className="mt-1.5 space-y-0.5 text-xs text-muted">
                  {parsed.title && <li>Title: {parsed.title}</li>}
                  {parsed.abstract && <li>Abstract: {plural(parsed.abstract.split(/\s+/).length, "word")}</li>}
                  {parsed.keywords.length > 0 && <li>Keywords: {parsed.keywords.join(", ")}</li>}
                  {parsed.skippedFrontMatterLines > 0 && (
                    <li>{plural(parsed.skippedFrontMatterLines, "author line")} skipped — add authors in Paper Details.</li>
                  )}
                  {parsed.skippedReferenceLines > 0 && (
                    <li>
                      {plural(parsed.skippedReferenceLines, "reference line")} skipped — add references by DOI or BibTeX
                      so citations stay linked.
                    </li>
                  )}
                  <li>Figures, tables and equations are not imported; add them as blocks afterwards.</li>
                </ul>
              </>
            )}
          </div>
        )}

        {parsed && (parsed.sectionCount > 0 || parsed.paragraphCount > 0) && (
          <fieldset className="mt-4 space-y-2 text-sm">
            <legend className="sr-only">Import options</legend>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="import-mode"
                checked={mode === "replace"}
                onChange={() => setMode("replace")}
                className="accent-accent"
              />
              Replace the current body content
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="import-mode"
                checked={mode === "append"}
                onChange={() => setMode("append")}
                className="accent-accent"
              />
              Add after the current content
            </label>
            {detailsFound && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={fillDetails}
                  onChange={(e) => setFillDetails(e.target.checked)}
                  className="accent-accent"
                />
                Fill in title, abstract and keywords where they're empty
              </label>
            )}
          </fieldset>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button type="button" onClick={onClose} className={`${btnSecondary} text-xs py-1.5 px-3`}>
            Cancel
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={!parsed || (parsed.sectionCount === 0 && parsed.paragraphCount === 0)}
            className={`${btnPrimary} text-xs py-1.5 px-4`}
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
}
