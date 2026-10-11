import { useState, type ChangeEvent } from "react";
import { useDocumentStore } from "../../store/documentStore";
import { useAuth } from "../../lib/useAuth";
import { EMPTY_JOURNAL, journalHeader, type JournalInfo } from "../../lib/formats/journal";
import { IMAGE_TYPES, imageFileProblem, uploadPaperImage } from "../../lib/uploadImage";
import { friendlyErrorMessage } from "../../lib/friendlyError";
import { inputBase, labelBase } from "../../lib/uiClasses";

const JOURNAL_FIELDS: { key: keyof JournalInfo; label: string; placeholder: string }[] = [
  { key: "name", label: "Journal name", placeholder: "IEEE Transactions on Robotics" },
  { key: "volume", label: "Volume", placeholder: "12" },
  { key: "number", label: "Number", placeholder: "3" },
  { key: "date", label: "Issue date", placeholder: "March 2026" },
];

function BiographyEditor({ authorId, name }: { authorId: string; name: string }) {
  const bio = useDocumentStore((s) => s.document.biographies?.find((b) => b.authorId === authorId));
  const setBiography = useDocumentStore((s) => s.setBiography);
  const documentId = useDocumentStore((s) => s.documentId);
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user || !documentId) return;
    const problem = imageFileProblem(file);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setUploading(true);
    try {
      setBiography(authorId, { photoUrl: await uploadPaperImage(file, user.id, documentId) });
    } catch (err) {
      setError(`Photo upload failed. ${friendlyErrorMessage(err)}`);
    } finally {
      setUploading(false);
    }
  }

  const textId = `bio-${authorId}`;
  return (
    <div className="mt-3">
      <label htmlFor={textId} className={labelBase}>
        {name}
      </label>
      <textarea
        id={textId}
        rows={3}
        value={bio?.text ?? ""}
        placeholder="received the B.S. degree in … from … in …. Her research interests include …"
        onChange={(e) => setBiography(authorId, { text: e.target.value })}
        className={`${inputBase} resize-y`}
      />
      <div className="flex items-center gap-3 mt-1.5 text-xs">
        <label className="text-accent cursor-pointer hover:underline">
          {uploading ? "Uploading…" : bio?.photoUrl ? "Replace photo" : "Add photo"}
          <input
            type="file"
            accept={IMAGE_TYPES.join(",")}
            className="sr-only"
            disabled={uploading || !documentId}
            onChange={handlePhoto}
          />
        </label>
        {bio?.photoUrl && (
          <button
            type="button"
            className="text-muted hover:text-ink hover:underline"
            onClick={() => setBiography(authorId, { photoUrl: undefined })}
          >
            Remove photo
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400 mt-1">
          {error}
        </p>
      )}
    </div>
  );
}

export function JournalFields({ biographies }: { biographies: boolean }) {
  const journal = useDocumentStore((s) => s.document.meta.journal ?? null);
  const authors = useDocumentStore((s) => s.document.titleBlock.authors);
  const setJournalInfo = useDocumentStore((s) => s.setJournalInfo);
  const current = journal ?? EMPTY_JOURNAL;

  function update(key: keyof JournalInfo, value: string) {
    setJournalInfo({ ...current, [key]: value });
  }

  const named = authors.filter((a) => a.name.trim());

  return (
    <div className="mt-4">
      <h4 className="text-sm font-medium text-ink">Journal details</h4>
      <div className="grid grid-cols-2 gap-x-3">
        {JOURNAL_FIELDS.map((f) => (
          <div key={f.key} className={f.key === "name" ? "col-span-2 mt-2" : "mt-2"}>
            <label htmlFor={`journal-${f.key}`} className={labelBase}>
              {f.label}
            </label>
            <input
              id={`journal-${f.key}`}
              value={current[f.key]}
              placeholder={f.placeholder}
              onChange={(e) => update(f.key, e.target.value)}
              className={inputBase}
            />
          </div>
        ))}
      </div>
      <p className="text-xs text-muted mt-1.5">Running head: {journalHeader(journal)}</p>

      <div className="mt-2">
        <label htmlFor="journal-received" className={labelBase}>
          Manuscript history
        </label>
        <input
          id="journal-received"
          value={current.received}
          placeholder="1 January 2026; revised 2 February 2026; accepted 3 March 2026"
          onChange={(e) => update("received", e.target.value)}
          className={inputBase}
        />
        <p className="text-xs text-muted mt-1.5">
          Printed as “Manuscript received …” in the first-page footnote, above each author’s affiliation.
        </p>
      </div>

      {biographies && (
        <>
          <h4 className="text-sm font-medium text-ink mt-5">Author biographies</h4>
          <p className="text-xs text-muted mt-0.5">
            Printed after the references with a 1 × 1.25 in photo. Start with what follows the name.
          </p>
          {named.length === 0 ? (
            <p className="text-xs text-muted mt-2">Add authors in Paper details first.</p>
          ) : (
            named.map((a) => <BiographyEditor key={a.id} authorId={a.id} name={a.name} />)
          )}
        </>
      )}
    </div>
  );
}
