import { useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { GuideLayout, GuideSection } from "../../components/guides/GuideLayout";
import { CopyButton } from "../../components/guides/CopyButton";
import { btnSecondary, cardBase, inputBase, labelBase } from "../../lib/uiClasses";
import { fetchCrossrefWork, workToFields } from "../../lib/doiLookup";
import { formatAuthorNames, formatIeeeReference } from "../../lib/tools/ieeeTools";

type FormState = {
  authors: string;
  title: string;
  venue: string;
  volume: string;
  pages: string;
  year: string;
  doi: string;
};

const EMPTY: FormState = { authors: "", title: "", venue: "", volume: "", pages: "", year: "", doi: "" };

const FIELDS: { key: Exclude<keyof FormState, "authors">; label: string; placeholder: string }[] = [
  { key: "title", label: "Article title", placeholder: "Influence of harmonics on power distribution system protection" },
  { key: "venue", label: "Journal or conference (abbreviated)", placeholder: "IEEE Trans. Power Del." },
  { key: "volume", label: "Volume", placeholder: "3" },
  { key: "pages", label: "Pages", placeholder: "549–557" },
  { key: "year", label: "Year", placeholder: "1988" },
  { key: "doi", label: "DOI (optional)", placeholder: "10.1109/61.193906" },
];

export function ReferenceFormatterPage() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [doiQuery, setDoiQuery] = useState("");
  const [lookupState, setLookupState] = useState<"idle" | "loading" | "error">("idle");

  const reference = useMemo(
    () => formatIeeeReference({ ...form, authors: formatAuthorNames(form.authors) }),
    [form]
  );

  async function handleLookup() {
    if (!doiQuery.trim()) return;
    setLookupState("loading");
    try {
      const work = await fetchCrossrefWork(doiQuery);
      const fields = workToFields(work);
      const authorLines = (work.author ?? [])
        .map((a) => a.name ?? `${a.given ?? ""} ${a.family ?? ""}`.trim())
        .join("\n");
      setForm({
        authors: authorLines,
        title: fields.title,
        venue: fields.venue,
        volume: fields.volume,
        pages: fields.pages,
        year: fields.year,
        doi: fields.doi ?? "",
      });
      setLookupState("idle");
    } catch (err) {
      console.error("DOI lookup failed:", err);
      setLookupState("error");
    }
  }

  return (
    <GuideLayout
      heading="IEEE reference formatter"
      intro={
        <p>
          Fill in the details of a journal article or conference paper — or paste its DOI — and get the reference
          in IEEE style, with author initials, quotation marks and punctuation in the right places.
        </p>
      }
    >
      <div className={`${cardBase} p-5 sm:p-6`}>
        <label htmlFor="doi-lookup" className={labelBase}>
          Start from a DOI
        </label>
        <div className="flex gap-2 mb-1">
          <input
            id="doi-lookup"
            value={doiQuery}
            onChange={(e) => setDoiQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLookup()}
            placeholder="10.1109/… or https://doi.org/…"
            className={inputBase}
          />
          <button type="button" onClick={handleLookup} disabled={lookupState === "loading"} className={`${btnSecondary} flex-none whitespace-nowrap`}>
            {lookupState === "loading" ? (
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            ) : (
              <Search size={14} aria-hidden="true" />
            )}
            Look up
          </button>
        </div>
        {lookupState === "error" && (
          <p role="alert" className="text-xs text-red-600 dark:text-red-400">
            CrossRef has no record for that DOI. Check it, or fill in the fields by hand.
          </p>
        )}
        <p className="text-xs text-muted mb-5">Details come from CrossRef, the registry that issues DOIs.</p>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label htmlFor="ref-authors" className={labelBase}>
              Authors — one per line, or separated by semicolons
            </label>
            <textarea
              id="ref-authors"
              rows={3}
              value={form.authors}
              onChange={(e) => setForm({ ...form, authors: e.target.value })}
              placeholder={"John F. Fuller\nFuchs, Ewald F.\nK. J. Roesler"}
              className={inputBase}
            />
          </div>
          {FIELDS.map((f) => (
            <div key={f.key} className={f.key === "title" || f.key === "venue" ? "sm:col-span-2" : undefined}>
              <label htmlFor={`ref-${f.key}`} className={labelBase}>
                {f.label}
              </label>
              <input
                id={`ref-${f.key}`}
                value={form[f.key]}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                placeholder={f.placeholder}
                className={inputBase}
              />
            </div>
          ))}
        </div>

        <div className="mt-6">
          <p className={labelBase}>IEEE reference</p>
          <output
            aria-live="polite"
            className="block min-h-[3rem] rounded-md border border-line bg-canvas px-4 py-3 font-serif text-[15px] leading-relaxed"
          >
            {reference ? `[1] ${reference}` : <span className="text-muted">Your reference appears here.</span>}
          </output>
          <div className="mt-3 flex items-center gap-3">
            <CopyButton text={reference} label="Copy reference" />
            <span className="text-xs text-muted">In the paper, set the journal or conference name in italics.</span>
          </div>
        </div>
      </div>

      <GuideSection title="How IEEE references work">
        <ul className="list-disc pl-6 space-y-2">
          <li>
            Sources are numbered in square brackets — [1], [2] — in the order they are first cited, and the
            reference list follows that order, not the alphabet.
          </li>
          <li>
            Authors are written as initials followed by the surname (J. F. Fuller). With more than six authors, list
            the first one followed by <em>et al.</em>
          </li>
          <li>The article title goes in quotation marks, in sentence case, followed by a comma inside the quotes.</li>
          <li>
            The journal or conference name is abbreviated and italicized, followed by volume, pages and date.
          </li>
        </ul>
      </GuideSection>

      <GuideSection title="Examples">
        <p className="font-medium">Journal article</p>
        <p className="font-serif rounded-md bg-surface border border-line px-4 py-3">
          [1] J. F. Fuller, E. F. Fuchs, and K. J. Roesler, “Influence of harmonics on power distribution system
          protection,” <em>IEEE Trans. Power Del.</em>, vol. 3, no. 2, pp. 549–557, Apr. 1988.
        </p>
        <p className="font-medium">Conference paper</p>
        <p className="font-serif rounded-md bg-surface border border-line px-4 py-3">
          [2] A. Author and B. Author, “Title of the paper,” in <em>Proc. Abbrev. Conf. Name</em>, City, Country,
          Year, pp. 1–5.
        </p>
        <p className="text-sm text-muted">
          This formatter covers journal articles and conference papers, the two most common reference types. Books,
          standards, patents and websites each have their own IEEE layout.
        </p>
      </GuideSection>
    </GuideLayout>
  );
}
