import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BadgeCheck, Loader2, XCircle } from "lucide-react";
import { findDois, looksLikeReferenceList } from "../../lib/citationGuardrail";
import { fetchCrossrefWork, workToFields } from "../../lib/doiLookup";

type DoiState = { status: "checking" } | { status: "verified"; title: string; authors: string; year: string } | { status: "not-found" };

const MAX_CHECKED = 6;
// Shared across messages so re-renders and repeated DOIs don't refetch.
const cache = new Map<string, Promise<DoiState>>();

function checkDoi(doi: string): Promise<DoiState> {
  const key = doi.toLowerCase();
  let pending = cache.get(key);
  if (!pending) {
    pending = fetchCrossrefWork(doi)
      .then((work): DoiState => {
        const f = workToFields(work);
        return { status: "verified", title: f.title, authors: f.authors, year: f.year };
      })
      .catch((): DoiState => ({ status: "not-found" }));
    cache.set(key, pending);
  }
  return pending;
}

/** Verifies DOIs an assistant reply mentions and flags reference lists it can't verify. */
export function CitationCheck({ text }: { text: string }) {
  const dois = useMemo(() => findDois(text).slice(0, MAX_CHECKED), [text]);
  const referenceList = useMemo(() => looksLikeReferenceList(text), [text]);
  const [states, setStates] = useState<Record<string, DoiState>>({});

  useEffect(() => {
    let cancelled = false;
    for (const doi of dois) {
      setStates((s) => (s[doi] ? s : { ...s, [doi]: { status: "checking" } }));
      checkDoi(doi).then((state) => {
        if (!cancelled) setStates((s) => ({ ...s, [doi]: state }));
      });
    }
    return () => {
      cancelled = true;
    };
  }, [dois]);

  if (dois.length === 0 && !referenceList) return null;

  return (
    <div className="w-full rounded-md border border-line bg-canvas px-3 py-2.5 font-sans text-xs">
      {referenceList && (
        <p className="flex gap-1.5 text-amber-800 dark:text-amber-300 mb-1.5">
          <AlertTriangle size={13} className="flex-none mt-px" aria-hidden="true" />
          AI-suggested references are often made up. Only cite a source after finding it yourself or verifying its DOI
          — in the editor, use References → Add by DOI.
        </p>
      )}
      {dois.length > 0 && (
        <>
          <p className="font-semibold text-ink mb-1">DOIs in this reply, checked against CrossRef</p>
          <ul className="space-y-1">
            {dois.map((doi) => {
              const state = states[doi] ?? { status: "checking" };
              return (
                <li key={doi} className="flex gap-1.5">
                  {state.status === "checking" ? (
                    <Loader2 size={13} className="flex-none mt-px animate-spin text-muted" aria-label="Checking" />
                  ) : state.status === "verified" ? (
                    <BadgeCheck size={13} className="flex-none mt-px text-emerald-600 dark:text-emerald-400" aria-label="Verified" />
                  ) : (
                    <XCircle size={13} className="flex-none mt-px text-red-600 dark:text-red-400" aria-label="Not found" />
                  )}
                  <span className="min-w-0">
                    <span className="font-mono">{doi}</span>
                    {state.status === "verified" && (
                      <span className="block text-muted">
                        {state.title}
                        {state.authors ? ` — ${state.authors}` : ""}
                        {state.year ? `, ${state.year}` : ""}. Check it says what the reply claims before citing.
                      </span>
                    )}
                    {state.status === "not-found" && (
                      <span className="block text-red-700 dark:text-red-400">Not found in CrossRef — do not cite this.</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
