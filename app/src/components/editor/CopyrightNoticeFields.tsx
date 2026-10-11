import { useDocumentStore } from "../../store/documentStore";
import {
  COPYRIGHT_VARIANTS,
  copyrightText,
  defaultCopyrightNotice,
  type CopyrightNotice,
  type CopyrightVariant,
} from "../../lib/formats/copyright";
import { inputBase, labelBase } from "../../lib/uiClasses";

export function CopyrightNoticeFields() {
  const notice = useDocumentStore((s) => s.document.meta.copyrightNotice ?? null);
  const setCopyrightNotice = useDocumentStore((s) => s.setCopyrightNotice);

  function update(patch: Partial<CopyrightNotice>) {
    if (notice) setCopyrightNotice({ ...notice, ...patch });
  }

  return (
    <div className="mt-4">
      <label className="flex items-start gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={notice !== null}
          onChange={(e) => setCopyrightNotice(e.target.checked ? defaultCopyrightNotice() : null)}
          className="mt-0.5 flex-none"
        />
        <span>
          Copyright notice on page 1
          <span className="block text-xs text-muted mt-0.5">
            For the final (camera-ready) version only. Copy the code and price from your conference's IEEE
            copyright form; leave this off for the review submission.
          </span>
        </span>
      </label>

      {notice && (
        <div className="mt-3 ml-6 flex flex-col gap-3">
          <div>
            <label htmlFor="copyright-variant" className={labelBase}>
              Copyright holder
            </label>
            <select
              id="copyright-variant"
              value={notice.variant}
              onChange={(e) => update({ variant: e.target.value as CopyrightVariant })}
              className={`${inputBase} cursor-pointer`}
            >
              {COPYRIGHT_VARIANTS.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>

          {notice.variant === "custom" ? (
            <div>
              <label htmlFor="copyright-text" className={labelBase}>
                Notice text
              </label>
              <input
                id="copyright-text"
                value={notice.text ?? ""}
                onChange={(e) => update({ text: e.target.value })}
                className={inputBase}
              />
            </div>
          ) : notice.variant !== "us-gov" ? (
            <div className="grid grid-cols-[1fr_5rem_5rem] gap-2">
              <div>
                <label htmlFor="copyright-code" className={labelBase}>
                  Code
                </label>
                <input
                  id="copyright-code"
                  value={notice.code}
                  onChange={(e) => update({ code: e.target.value })}
                  className={`${inputBase} font-mono text-xs`}
                />
              </div>
              <div>
                <label htmlFor="copyright-year" className={labelBase}>
                  Year
                </label>
                <input
                  id="copyright-year"
                  value={notice.year}
                  inputMode="numeric"
                  onChange={(e) => update({ year: e.target.value })}
                  className={inputBase}
                />
              </div>
              <div>
                <label htmlFor="copyright-price" className={labelBase}>
                  Price ($)
                </label>
                <input
                  id="copyright-price"
                  value={notice.price}
                  onChange={(e) => update({ price: e.target.value })}
                  className={inputBase}
                />
              </div>
            </div>
          ) : null}

          <p className="text-xs text-muted">
            Preview: <span className="font-serif text-ink">{copyrightText(notice) || "—"}</span>
          </p>
        </div>
      )}
    </div>
  );
}
