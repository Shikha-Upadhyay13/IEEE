import { useState } from "react";
import { AlertTriangle, BadgeCheck, ChevronRight, FileDown, Loader2, Search, ShieldCheck, X } from "lucide-react";
import { useDocumentStore } from "../../store/documentStore";
import { emptyReferenceFields, type ReferenceFields } from "../../lib/generateReferenceText";
import { parseBibtex } from "../../lib/bibtex";
import { lookupDoi } from "../../lib/doiLookup";
import { verifyReference, type VerifyResult } from "../../lib/referenceVerify";
import type { Reference } from "../../types/document";
import { btnPrimary, btnSecondary, cardBase, inputBase, labelBase } from "../../lib/uiClasses";

const FIELD_LABELS: { key: keyof ReferenceFields; label: string; placeholder: string }[] = [
  { key: "authors", label: "Authors", placeholder: "J. F. Fuller, E. F. Fuchs, and K. J. Roesler" },
  { key: "title", label: "Title", placeholder: "Influence of harmonics on power distribution system protection" },
  { key: "venue", label: "Venue (journal/conference)", placeholder: "IEEE Trans. Power Delivery" },
  { key: "volume", label: "Volume", placeholder: "3" },
  { key: "pages", label: "Pages", placeholder: "549-557" },
  { key: "year", label: "Year", placeholder: "1988" },
];

type CheckState = VerifyResult | { status: "checking" } | { status: "error"; message: string };

function VerifyStatus({ verified, check }: { verified: boolean; check: CheckState | undefined }) {
  if (check?.status === "checking") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted">
        <Loader2 size={12} className="animate-spin" aria-hidden="true" />
        Checking…
      </span>
    );
  }
  if (verified) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
        <BadgeCheck size={13} aria-hidden="true" />
        Verified
      </span>
    );
  }
  if (check?.status === "mismatch") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400">
        <AlertTriangle size={12} aria-hidden="true" />
        Details differ
      </span>
    );
  }
  if (check?.status === "not-found") {
    return <span className="text-xs text-muted">Not found in CrossRef</span>;
  }
  if (check?.status === "error") {
    return <span className="text-xs text-red-600 dark:text-red-400">Couldn't check</span>;
  }
  return null;
}

export function ReferencesEditor({ defaultExpanded = false }: { defaultExpanded?: boolean }) {
  const references = useDocumentStore((s) => s.document.references);
  const addReference = useDocumentStore((s) => s.addReference);
  const addReferenceWithFields = useDocumentStore((s) => s.addReferenceWithFields);
  const importReferences = useDocumentStore((s) => s.importReferences);
  const updateReferenceField = useDocumentStore((s) => s.updateReferenceField);
  const removeReference = useDocumentStore((s) => s.removeReference);

  const markReferenceVerified = useDocumentStore((s) => s.markReferenceVerified);
  const replaceReferenceFields = useDocumentStore((s) => s.replaceReferenceFields);

  const [expanded, setExpanded] = useState(defaultExpanded);
  const [checks, setChecks] = useState<Record<string, CheckState>>({});
  const [verifyingAll, setVerifyingAll] = useState(false);
  const unverifiedCount = references.filter((r) => !r.fields.verifiedAt).length;

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

  async function verifyOne(ref: Reference) {
    const fields = { ...emptyReferenceFields, ...(ref.fields as ReferenceFields) };
    setChecks((c) => ({ ...c, [ref.id]: { status: "checking" } }));
    try {
      const result = await verifyReference(fields);
      if (result.status === "verified") markReferenceVerified(ref.id, result.doi);
      setChecks((c) => ({ ...c, [ref.id]: result }));
    } catch (err: unknown) {
      setChecks((c) => ({
        ...c,
        [ref.id]: { status: "error", message: err instanceof Error ? err.message : "Verification failed." },
      }));
    }
  }

  async function verifyAll() {
    setVerifyingAll(true);
    for (const ref of references.filter((r) => !r.fields.verifiedAt)) {
      await verifyOne(ref);
      // Stay well inside CrossRef's public rate limit.
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    setVerifyingAll(false);
  }

  function editField(id: string, key: keyof ReferenceFields, value: string) {
    updateReferenceField(id, key, value);
    setChecks((c) => {
      if (!(id in c)) return c;
      const next = { ...c };
      delete next[id];
      return next;
    });
  }

  function dismissCheck(id: string) {
    setChecks((c) => {
      const next = { ...c };
      delete next[id];
      return next;
    });
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
          className="flex-none w-4 h-4 flex items-center justify-center text-muted transition-transform"
          style={{ transform: expanded ? "rotate(90deg)" : "none" }}
        >
          <ChevronRight size={16} aria-hidden="true" />
        </span>
        <h2 className="text-base font-semibold text-ink">References</h2>
        <span className="text-xs text-muted">
          {references.length === 0 ? "empty" : references.length}
        </span>
      </button>

      {expanded && (
        <div className="mt-4">
          {references.length === 0 && (
            <p className="text-xs text-muted mb-3">
              No references yet — add one manually, import from BibTeX, or look up by DOI, then cite it from any paragraph's "+ Citation…" menu.
            </p>
          )}

          <div className="flex flex-col gap-2 mb-3">
            {references.map((ref, index) => {
              const fields = { ...emptyReferenceFields, ...(ref.fields as ReferenceFields) };
              const check = checks[ref.id];
              const verified = Boolean(fields.verifiedAt);
              return (
                <div key={ref.id} className="rounded-lg border border-line bg-canvas p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-muted">[{index + 1}]</span>
                    <VerifyStatus verified={verified} check={check} />
                    <span className="flex-1" />
                    {!verified && (
                      <button
                        type="button"
                        onClick={() => verifyOne(ref)}
                        disabled={check?.status === "checking" || verifyingAll}
                        className="text-xs font-medium text-accent hover:text-accent-hover disabled:opacity-50"
                      >
                        Verify
                      </button>
                    )}
                    <button
                      onClick={() => removeReference(ref.id)}
                      aria-label="Delete reference"
                      className="w-6 h-6 flex items-center justify-center rounded text-muted/60 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  </div>
                  {check?.status === "mismatch" && (
                    <div className="mb-2 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                      <p className="font-medium mb-1">CrossRef has a close match with different details:</p>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {check.differences.map((d) => (
                          <li key={d}>{d}</li>
                        ))}
                      </ul>
                      <div className="flex gap-3 mt-2">
                        <button
                          type="button"
                          onClick={() => {
                            replaceReferenceFields(ref.id, {
                              ...check.crossref,
                              doi: check.doi,
                              verifiedAt: new Date().toISOString(),
                            });
                            dismissCheck(ref.id);
                          }}
                          className="font-medium underline hover:no-underline"
                        >
                          Use CrossRef details
                        </button>
                        <button type="button" onClick={() => dismissCheck(ref.id)} className="hover:underline">
                          Keep mine
                        </button>
                      </div>
                    </div>
                  )}
                  {check?.status === "not-found" && (
                    <p className="mb-2 text-xs text-muted">
                      {check.reason} Books, standards and web pages are often missing from CrossRef — check those by
                      hand.
                    </p>
                  )}
                  {check?.status === "error" && (
                    <p className="mb-2 text-xs text-red-600 dark:text-red-400">{check.message}</p>
                  )}
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
                          onChange={(e) => editField(ref.id, key, e.target.value)}
                          className={inputBase}
                        />
                      </div>
                    ))}
                  </div>
                  {ref.renderedText && (
                    <p className="text-xs text-muted mt-2 italic">{ref.renderedText}</p>
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
              <FileDown size={14} aria-hidden="true" />
              <span>Import BibTeX</span>
            </button>
            <button
              onClick={() => {
                setDoiError(null);
                setShowDoiModal(true);
              }}
              className={`${btnSecondary} text-xs py-1.5 px-3 flex items-center gap-1.5`}
            >
              <Search size={14} aria-hidden="true" />
              <span>Add by DOI</span>
            </button>
            {references.length > 0 && (
              <button
                type="button"
                onClick={verifyAll}
                disabled={verifyingAll || unverifiedCount === 0}
                className={`${btnSecondary} text-xs py-1.5 px-3 flex items-center gap-1.5 sm:ml-auto`}
                title="Check each unverified reference against CrossRef"
              >
                {verifyingAll ? (
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                ) : (
                  <ShieldCheck size={14} aria-hidden="true" />
                )}
                <span>{unverifiedCount === 0 ? "All verified" : `Verify all (${unverifiedCount})`}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* BibTeX Import Modal */}
      {showBibtexModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-surface border border-line rounded-2xl shadow-2xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <h3 className="text-sm font-semibold text-ink">Import BibTeX References</h3>
              <button
                onClick={() => setShowBibtexModal(false)}
                aria-label="Close"
                className="text-muted hover:text-ink text-sm"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <p className="text-xs text-muted mt-3 mb-2">
              Paste one or multiple BibTeX entries exported from Google Scholar, IEEE Xplore, or DBLP:
            </p>
            <textarea
                aria-label="BibTeX entries"
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
          <div className="bg-surface border border-line rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <h3 className="text-sm font-semibold text-ink">Add Reference by DOI</h3>
              <button
                onClick={() => setShowDoiModal(false)}
                aria-label="Close"
                className="text-muted hover:text-ink text-sm"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <p className="text-xs text-muted mt-3 mb-2">
              Enter any Digital Object Identifier (DOI) or DOI URL:
            </p>
            <input
              type="text"
                aria-label="DOI"
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
