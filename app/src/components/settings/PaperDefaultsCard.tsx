import { useEffect, useState, type FormEvent } from "react";
import { btnPrimary, cardBase, inputBase, labelBase } from "../../lib/uiClasses";
import { friendlyErrorMessage } from "../../lib/friendlyError";
import { FORMAT_LIST } from "../../lib/formats/formats";
import { MODES } from "../../lib/formats/modes";
import { loadProfile, saveProfile, type PaperDefaults, type Profile } from "../../lib/profile";

const selectClass = `${inputBase} cursor-pointer`;

export function PaperDefaultsCard({ userId, className = "" }: { userId: string; className?: string }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [defaults, setDefaults] = useState<PaperDefaults>({});
  const [spellcheck, setSpellcheck] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadProfile(userId)
      .then((p) => {
        if (cancelled) return;
        setProfile(p);
        setDefaults(p.paperDefaults);
        setSpellcheck(p.editorPreferences.spellcheck ?? true);
      })
      .catch((err) => !cancelled && setError(friendlyErrorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  function set<K extends keyof PaperDefaults>(key: K, value: string) {
    setSaved(false);
    setDefaults((d) => ({ ...d, [key]: value || undefined }));
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setError(null);
    try {
      const next = await saveProfile(userId, {
        ...profile,
        paperDefaults: defaults,
        editorPreferences: { ...profile.editorPreferences, spellcheck },
      });
      setProfile(next);
      setSaved(true);
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className={`${cardBase} p-6 ${className}`}>
      <h2 className="text-base font-semibold text-ink mb-1">New papers and writing</h2>
      <p className="text-sm text-muted mb-4">
        Where new papers start. You can still change any of these per paper in the editor's Format panel.
      </p>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="default-format" className={labelBase}>
            Format
          </label>
          <select
            id="default-format"
            value={defaults.template ?? "ieee-conference"}
            onChange={(e) => set("template", e.target.value)}
            disabled={!profile}
            className={selectClass}
          >
            {FORMAT_LIST.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="default-size" className={labelBase}>
            Paper size
          </label>
          <select
            id="default-size"
            value={defaults.paperSize ?? "letter"}
            onChange={(e) => set("paperSize", e.target.value)}
            disabled={!profile}
            className={selectClass}
          >
            <option value="letter">US Letter</option>
            <option value="a4">A4</option>
          </select>
        </div>
        <div>
          <label htmlFor="default-mode" className={labelBase}>
            Mode
          </label>
          <select
            id="default-mode"
            value={defaults.mode ?? "submission"}
            onChange={(e) => set("mode", e.target.value)}
            disabled={!profile}
            className={selectClass}
          >
            {MODES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="default-dialect" className={labelBase}>
            Spelling
          </label>
          <select
            id="default-dialect"
            value={defaults.dialect ?? ""}
            onChange={(e) => set("dialect", e.target.value)}
            disabled={!profile}
            className={selectClass}
          >
            <option value="">Browser default</option>
            <option value="en-US">US English (color, analyze)</option>
            <option value="en-GB">UK English (colour, analyse)</option>
          </select>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-ink mt-4">
        <input
          type="checkbox"
          checked={spellcheck}
          onChange={(e) => {
            setSaved(false);
            setSpellcheck(e.target.checked);
          }}
          disabled={!profile}
          className="accent-accent"
        />
        Underline spelling mistakes while I write
      </label>
      <p className="text-xs text-muted mt-1 ml-6">
        Spelling is checked by your browser, in the dialect above when it has that dictionary installed.
      </p>

      <div className="mt-5 flex items-center gap-3">
        <button type="submit" disabled={!profile || saving} className={btnPrimary}>
          {saving ? "Saving…" : "Save preferences"}
        </button>
        {saved && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400" role="status">
            Saved.
          </span>
        )}
      </div>
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 mt-2" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
