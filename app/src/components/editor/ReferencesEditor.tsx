import { useState } from "react";
import { useDocumentStore } from "../../store/documentStore";
import { emptyReferenceFields, type ReferenceFields } from "../../lib/generateReferenceText";
import { parseBibtex } from "../../lib/bibtex";
import { lookupDoi } from "../../lib/doiLookup";
import { btnPrimary, btnSecondary, cardBase, inputBase, labelBase } from "../../lib/uiClasses";

const FIELD_LABELS: { key: keyof ReferenceFields; label: string; placeholder: string }[] = [
  { key: "authors", label: "Authors", placeholder: "J. F. Fuller, E. F. Fuchs, and K. J. Roesler" },
  { key: "title", label: "Title", placeholder: "Influence of harmonics on power distribution system protection" },
  { key: "venue", label: "Venue (journal/conference)", placeholder: "IEEE Trans. Power Delivery" },
  { key: "volume", label: "Volume", placeholder: "3" },
  { key: "pages", label: "Pages", placeholder: "549-557" },
  { key: "year", label: "Year", placeholder: "1988" },
];

export function ReferencesEditor() {
  const references = useDocumentStore((s) => s.document.references);
  const addReference = useDocumentStore((s) => s.addReference);
  const addReferenceWithFields = useDocumentStore((s) => s.addReferenceWithFields);
  const importReferences = useDocumentStore((s) => s.importReferences);
  const updateReferenceField = useDocumentStore((s) => s.updateReferenceField);
  const removeReference = useDocumentStore((s) => s.removeReference);

  const [expanded, setExpanded] = useState(false);

  // BibTeX Import Modal State
  const [showBibtexModal, setShowBibtexModal] = useState(false);
  const [bibtexInput, setBibtexInput] = useState("");
  const [bibtexError, setBibtexError] = useState<string | null>(null);

  // DOI Lookup Modal State
  const [showDoiModal, setShowDoiModal] = useState(false);
  const [doiInput, setDoiInput] = useState("");
  const [doiLoading, setDoiLoading] = useState(false);
  const [doiError, setDoiError] = useState<string | null>(null);

  function handleImportBibtex() {
    setBibtexError(null);
    if (!bibtexInput.trim()) {
      setBibtexError("Please paste one or more BibTeX entries.");
      return;
    }
    const parsed = parseBibtex(bibtexInput);
    if (parsed.length === 0) {
      setBibtexError("Could not find any valid BibTeX entries (@article, @inproceedings, etc.). Check formatting.");
      return;
    }
    importReferences(parsed);
    setBibtexInput("");
    setShowBibtexModal(false);
  }

  async function handleLookupDoi() {
    setDoiError(null);
    if (!doiInput.trim()) {
      setDoiError("Please enter a DOI (e.g. 10.1109/5.771073).");
      return;
    }
    setDoiLoading(true);
    try {
      const fields = await lookupDoi(doiInput);
      addReferenceWithFields(fields);
      setDoiInput("");
      setShowDoiModal(false);
    } catch (err: unknown) {
      setDoiError(err instanceof Error ? err.message : "Failed to fetch DOI metadata.");
    } finally {
      setDoiLoading(false);
    }
  }

  return (
    <div className={`${cardBase} p-5`}>
      <button
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="w-full flex items-center gap-2 text-left"
      >
        <span
          className="flex-none w-4 h-4 flex items-center justify-center text-gray-400 dark:text-gray-500 transition-transform"
          style={{ transform: expanded ? "rotate(90deg)" : "none" }}
        >
          ▸
        </span>
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">References</h2>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {references.length === 0 ? "empty" : references.length}
        </span>
      </button>

      {expanded && (
        <div className="mt-4">
          {references.length === 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
              No references yet — add one manually, import from BibTeX, or look up by DOI, then cite it from any paragraph's "+ Citation…" menu.
            </p>
          )}

          <div className="flex flex-col gap-2 mb-3">
            {references.map((ref, index) => {
              const fields = { ...emptyReferenceFields, ...(ref.fields as ReferenceFields) };
              return (
                <div key={ref.id} className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold text-gray-400 dark:text-gray-500">[{index + 1}]</span>
                    <button
                      onClick={() => removeReference(ref.id)}
                      aria-label="Delete reference"
                      className="w-6 h-6 flex items-center justify-center rounded text-gray-300 dark:text-gray-600 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {FIELD_LABELS.map(({ key, label, placeholder }) => (
                      <div key={key} className={key === "authors" || key === "title" ? "col-span-2" : ""}>
                        <label htmlFor={`ref-${ref.id}-${key}`} className={labelBase}>
                          {label}
                        </label>
                        <input
                          id={`ref-${ref.id}-${key}`}
                          value={fields[key]}
                          placeholder={placeholder}
                          onChange={(e) => updateReferenceField(ref.id, key, e.target.value)}
                          className={inputBase}
                        />
                      </div>
                    ))}
                  </div>
                  {ref.renderedText && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">{ref.renderedText}</p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={addReference} className={`${btnSecondary} text-xs py-1.5 px-3`}>
              + Manual Reference
            </button>
            <button
              onClick={() => {
                setBibtexError(null);
                setShowBibtexModal(true);
              }}
              className={`${btnSecondary} text-xs py-1.5 px-3 flex items-center gap-1.5`}
            >
              <span>📥</span>
              <span>Import BibTeX</span>
            </button>
            <button
              onClick={() => {
                setDoiError(null);
                setShowDoiModal(true);
              }}
              className={`${btnSecondary} text-xs py-1.5 px-3 flex items-center gap-1.5`}
            >
              <span>🔍</span>
              <span>Add by DOI</span>
            </button>
          </div>
        </div>
      )}

      {/* BibTeX Import Modal */}
      {showBibtexModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Import BibTeX References</h3>
              <button
                onClick={() => setShowBibtexModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 mb-2">
              Paste one or multiple BibTeX entries exported from Google Scholar, IEEE Xplore, or DBLP:
            </p>
            <textarea
              value={bibtexInput}
              onChange={(e) => setBibtexInput(e.target.value)}
              rows={8}
              placeholder={`@article{smith2023,\n  author = {Smith, John and Davis, Robert},\n  title = {Autonomous Mobile Robot Navigation},\n  journal = {IEEE Transactions on Robotics},\n  year = {2023},\n  volume = {39},\n  pages = {1012--1028}\n}`}
              className={`${inputBase} font-mono text-xs w-full py-2 resize-y`}
            />
            {bibtexError && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-2">{bibtexError}</p>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setShowBibtexModal(false)}
                className={`${btnSecondary} text-xs py-1.5 px-3`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImportBibtex}
                className={`${btnPrimary} text-xs py-1.5 px-4`}
              >
                Import Entries
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DOI Lookup Modal */}
      {showDoiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Add Reference by DOI</h3>
              <button
                onClick={() => setShowDoiModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 mb-2">
              Enter any Digital Object Identifier (DOI) or DOI URL:
            </p>
            <input
              type="text"
              value={doiInput}
              onChange={(e) => setDoiInput(e.target.value)}
              placeholder="e.g. 10.1109/TRO.2023.1001 or https://doi.org/..."
              className={`${inputBase} text-xs w-full`}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLookupDoi();
              }}
            />
            {doiError && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-2">{doiError}</p>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setShowDoiModal(false)}
                className={`${btnSecondary} text-xs py-1.5 px-3`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLookupDoi}
                disabled={doiLoading}
                className={`${btnPrimary} text-xs py-1.5 px-4`}
              >
                {doiLoading ? "Fetching metadata…" : "Add Reference"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
