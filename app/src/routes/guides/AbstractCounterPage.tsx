import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { GuideLayout, GuideSection } from "../../components/guides/GuideLayout";
import { cardBase, inputBase, labelBase } from "../../lib/uiClasses";
import { abstractStats } from "../../lib/tools/ieeeTools";

const LIMITS = [150, 200, 250];

export function AbstractCounterPage() {
  const [text, setText] = useState("");
  const [limit, setLimit] = useState(250);
  const stats = useMemo(() => abstractStats(text), [text]);
  const over = stats.words - limit;
  const pct = Math.min(100, (stats.words / limit) * 100);

  return (
    <GuideLayout
      heading="IEEE abstract word counter"
      intro={
        <p>
          Paste your abstract to count its words against the limit your venue sets, and to catch things IEEE
          abstracts shouldn't contain — citations, equations and references to figures.
        </p>
      }
    >
      <div className={`${cardBase} p-5 sm:p-6`}>
        <label htmlFor="abstract-input" className={labelBase}>
          Abstract
        </label>
        <textarea
          id="abstract-input"
          rows={9}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste your abstract here…"
          className={inputBase}
        />

        <fieldset className="mt-4">
          <legend className={labelBase}>Word limit</legend>
          <div className="flex flex-wrap gap-2">
            {LIMITS.map((l) => (
              <label
                key={l}
                className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent ${
                  limit === l ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-ink"
                }`}
              >
                <input
                  type="radio"
                  name="limit"
                  value={l}
                  checked={limit === l}
                  onChange={() => setLimit(l)}
                  className="sr-only"
                />
                {l} words
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-6" aria-live="polite">
          <div className="flex items-baseline justify-between">
            <p className="text-3xl font-semibold tabular-nums">
              {stats.words}
              <span className="text-base font-normal text-muted"> / {limit} words</span>
            </p>
            <p className="text-sm text-muted">
              {stats.sentences} sentences · {stats.characters} characters
            </p>
          </div>
          <div className="mt-2 h-2 rounded-full bg-line overflow-hidden" aria-hidden="true">
            <div
              className={`h-full transition-all ${over > 0 ? "bg-red-600" : "bg-accent"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {stats.words > 0 && (
            <p
              className={`mt-3 flex items-center gap-1.5 text-sm ${
                over > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"
              }`}
            >
              {over > 0 ? (
                <>
                  <AlertTriangle size={14} aria-hidden="true" /> {over} words over the limit.
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} aria-hidden="true" /> Within the limit ({-over} words to spare).
                </>
              )}
            </p>
          )}
          {stats.warnings.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {stats.warnings.map((w) => (
                <li key={w} className="flex items-start gap-1.5 text-sm text-amber-700 dark:text-amber-400">
                  <AlertTriangle size={14} className="mt-0.5 flex-none" aria-hidden="true" />
                  {w}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <GuideSection title="How long should an IEEE abstract be?">
        <p>
          It depends on the venue. IEEE journals ask for 150 to 250 words, and many IEEE conferences set their own
          limit — often 150 or 200 words — in the call for papers. The call for papers or the author kit always
          wins; use this counter with the number it gives.
        </p>
      </GuideSection>

      <GuideSection title="What an IEEE abstract should contain">
        <ul className="list-disc pl-6 space-y-2">
          <li>The problem, what you did, the main result and why it matters — in one paragraph.</li>
          <li>Plain sentences that make sense without the paper: no citations, footnotes or displayed equations.</li>
          <li>Abbreviations spelled out if you use them at all, and the key terms readers will search for.</li>
        </ul>
      </GuideSection>
    </GuideLayout>
  );
}
