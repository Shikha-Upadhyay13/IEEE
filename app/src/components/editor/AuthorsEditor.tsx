import { X } from "lucide-react";
import { useDocumentStore } from "../../store/documentStore";
import { btnSecondary, btnIcon, inputBase, labelBase } from "../../lib/uiClasses";

// IEEE groups authors by affiliation in the title block, so affiliations are
// edited first and each author just ticks which ones apply to them.
export function AuthorsEditor() {
  const authors = useDocumentStore((s) => s.document.titleBlock.authors);
  const affiliations = useDocumentStore((s) => s.document.titleBlock.affiliations);
  const addAuthor = useDocumentStore((s) => s.addAuthor);
  const updateAuthor = useDocumentStore((s) => s.updateAuthor);
  const removeAuthor = useDocumentStore((s) => s.removeAuthor);
  const addAffiliation = useDocumentStore((s) => s.addAffiliation);
  const updateAffiliation = useDocumentStore((s) => s.updateAffiliation);
  const removeAffiliation = useDocumentStore((s) => s.removeAffiliation);
  const toggleAuthorAffiliation = useDocumentStore((s) => s.toggleAuthorAffiliation);

  return (
    <div className="mb-4">
      <span className={labelBase}>Affiliations</span>
      <div className="flex flex-col gap-2 mb-2">
        {affiliations.map((aff, i) => (
          <div key={aff.id} className="flex items-center gap-2">
            <span className="flex-none w-5 text-xs text-muted text-right">{i + 1}.</span>
            <input
              value={aff.text}
              onChange={(e) => updateAffiliation(aff.id, e.target.value)}
              placeholder="Dept. of Computer Science, University Name, City, Country"
              aria-label={`Affiliation ${i + 1}`}
              className={inputBase}
            />
            <button
              type="button"
              onClick={() => removeAffiliation(aff.id)}
              aria-label={`Remove affiliation ${i + 1}`}
              className={`${btnIcon} hover:text-red-600`}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={addAffiliation} className={`${btnSecondary} text-xs py-1 px-2.5 mb-4`}>
        + Add affiliation
      </button>

      <span className={labelBase}>Authors</span>
      {authors.length === 0 && (
        <p className="text-xs text-muted mb-2">IEEE papers list every author under the title — add at least one.</p>
      )}
      <div className="flex flex-col gap-3 mb-2">
        {authors.map((author, i) => (
          <div key={author.id} className="rounded-md border border-line bg-canvas/50 p-2.5">
            <div className="flex items-center gap-2">
              <input
                value={author.name}
                onChange={(e) => updateAuthor(author.id, { name: e.target.value })}
                placeholder="Full name"
                aria-label={`Author ${i + 1} name`}
                className={inputBase}
              />
              <input
                type="email"
                value={author.email ?? ""}
                onChange={(e) => updateAuthor(author.id, { email: e.target.value || undefined })}
                placeholder="Email (optional)"
                aria-label={`Author ${i + 1} email`}
                className={inputBase}
              />
              <button
                type="button"
                onClick={() => removeAuthor(author.id)}
                aria-label={`Remove author ${i + 1}`}
                className={`${btnIcon} hover:text-red-600`}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
            {affiliations.length > 0 && (
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                {affiliations.map((aff, j) => (
                  <label key={aff.id} className="flex items-center gap-1.5 text-xs text-ink cursor-pointer">
                    <input
                      type="checkbox"
                      checked={author.affiliationRefs.includes(aff.id)}
                      onChange={() => toggleAuthorAffiliation(author.id, aff.id)}
                    />
                    {j + 1}. {aff.text.trim() ? aff.text.slice(0, 32) + (aff.text.length > 32 ? "…" : "") : "Untitled affiliation"}
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <button type="button" onClick={addAuthor} className={`${btnSecondary} text-xs py-1 px-2.5`}>
        + Add author
      </button>
    </div>
  );
}
