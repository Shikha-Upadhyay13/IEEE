import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { GuideLayout, GuideSection } from "../../components/guides/GuideLayout";
import { CopyButton } from "../../components/guides/CopyButton";
import { cardBase, inputBase, labelBase } from "../../lib/uiClasses";
import { bibtexToIeee, numberedList } from "../../lib/tools/ieeeTools";

const SAMPLE = `@article{fuller1988,
  author  = {Fuller, John F. and Fuchs, Ewald F. and Roesler, Karl J.},
  title   = {Influence of harmonics on power distribution system protection},
  journal = {IEEE Trans. Power Del.},
  volume  = {3},
  pages   = {549--557},
  year    = {1988}
}`;

export function BibtexConverterPage() {
  const [input, setInput] = useState(SAMPLE);
  const refs = useMemo(() => bibtexToIeee(input), [input]);
  const list = numberedList(refs);

  return (
    <GuideLayout
      heading="BibTeX to IEEE converter"
      intro={
        <p>
          Paste one or more BibTeX entries — from Google Scholar, Zotero, Mendeley or a <code>.bib</code> file — and
          get a numbered reference list in IEEE style. Everything runs in your browser; nothing is uploaded.
        </p>
      }
    >
      <div className={`${cardBase} p-5 sm:p-6`}>
        <label htmlFor="bibtex-input" className={labelBase}>
          BibTeX
        </label>
        <textarea
          id="bibtex-input"
          rows={10}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
          className={`${inputBase} font-mono text-xs`}
        />

        <div className="mt-6">
          <div className="flex items-center justify-between mb-1">
            <p className={labelBase}>
              IEEE reference list {refs.length > 0 && `(${refs.length})`}
            </p>
          </div>
          <output aria-live="polite" className="block rounded-md border border-line bg-canvas px-4 py-3">
            {refs.length === 0 ? (
              <span className="text-muted text-sm">
                No entries found yet. Each entry starts with @ — for example @article&#123;key, …&#125;.
              </span>
            ) : (
              <ol className="space-y-3">
                {refs.map((r) => (
                  <li key={r.number} className="font-serif text-[15px] leading-relaxed">
                    [{r.number}] {r.text}
                    {r.missing.length > 0 && (
                      <span className="mt-1 flex items-center gap-1.5 font-sans text-xs text-amber-700 dark:text-amber-400">
                        <AlertTriangle size={12} aria-hidden="true" />
                        Missing {r.missing.join(", ")}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </output>
          <div className="mt-3">
            <CopyButton text={list} label="Copy list" />
          </div>
        </div>
      </div>

      <GuideSection title="What the converter does">
        <ul className="list-disc pl-6 space-y-2">
          <li>
            Turns <code>author</code> fields like <code>Fuller, John F. and Fuchs, Ewald F.</code> into IEEE initials:
            J. F. Fuller and E. F. Fuchs.
          </li>
          <li>Removes the braces BibTeX uses to protect capitals, and turns page ranges like 549--557 into 549-557.</li>
          <li>
            Uses <code>journal</code>, <code>booktitle</code>, <code>publisher</code> or <code>institution</code> as
            the venue, and flags entries that are missing authors, a venue or a year.
          </li>
        </ul>
      </GuideSection>

      <GuideSection title="Before you submit">
        <p>
          BibTeX exported from search engines is often incomplete or wrong — misspelled names, missing page numbers,
          preprint venues. Check each reference against the published version. Numbering here follows the order of
          the entries; in your paper it must follow the order in which sources are first cited.
        </p>
      </GuideSection>
    </GuideLayout>
  );
}
