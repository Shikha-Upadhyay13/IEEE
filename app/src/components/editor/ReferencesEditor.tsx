import { useState } from "react";
import { useDocumentStore } from "../../store/documentStore";
import { emptyReferenceFields, type ReferenceFields } from "../../lib/generateReferenceText";
import { btnSecondary, cardBase, inputBase, labelBase } from "../../lib/uiClasses";

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
  const updateReferenceField = useDocumentStore((s) => s.updateReferenceField);
  const removeReference = useDocumentStore((s) => s.removeReference);
  // Collapsed by default, same "hide it until clicked" idea as Body
  // Content's sections — but one toggle for the whole card, not per-item:
  // references are flat, short entries, not nested content worth folding
  // individually, so a single expand/collapse is enough here.
  const [expanded, setExpanded] = useState(false);

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
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
              No references yet — add one, then cite it from any paragraph's "+ Citation…" menu.
            </p>
          )}

          <div className="flex flex-col gap-2 mb-2">
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

          <button onClick={addReference} className={btnSecondary}>
            + Reference
          </button>
        </div>
      )}
    </div>
  );
}
