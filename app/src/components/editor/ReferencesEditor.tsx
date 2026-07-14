import { useDocumentStore } from "../../store/documentStore";
import { emptyReferenceFields, type ReferenceFields } from "../../lib/generateReferenceText";
import { btnDanger, btnSecondary, cardBase, inputBase, labelBase } from "../../lib/uiClasses";

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

  return (
    <div className="mt-6">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
        References
      </h3>

      {references.length === 0 && (
        <p className="text-xs text-gray-400 mb-2">
          No references yet — add one, then cite it from any paragraph's "+ Citation…" menu.
        </p>
      )}

      <div className="flex flex-col gap-2 mb-2">
        {references.map((ref, index) => {
          const fields = { ...emptyReferenceFields, ...(ref.fields as ReferenceFields) };
          return (
            <div key={ref.id} className={`${cardBase} p-3`}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-gray-400">[{index + 1}]</span>
                <button onClick={() => removeReference(ref.id)} className={btnDanger}>
                  Delete
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
                <p className="text-xs text-gray-500 mt-2 italic">{ref.renderedText}</p>
              )}
            </div>
          );
        })}
      </div>

      <button onClick={addReference} className={btnSecondary}>
        + Reference
      </button>
    </div>
  );
}
