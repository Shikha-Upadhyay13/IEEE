import { useEffect, useState, type FormEvent } from "react";
import { btnPrimary, cardBase, inputBase, labelBase } from "../../lib/uiClasses";
import { friendlyErrorMessage } from "../../lib/friendlyError";
import { MAX_AFFILIATION, MAX_NAME, loadProfile, normalizeOrcid, saveProfile, type Profile } from "../../lib/profile";

export function ProfileTab({ userId, email }: { userId: string; email: string | undefined }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState("");
  const [orcid, setOrcid] = useState("");
  const [affiliation, setAffiliation] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadProfile(userId)
      .then((p) => {
        if (cancelled) return;
        setProfile(p);
        setFullName(p.fullName);
        setOrcid(p.orcid);
        setAffiliation(p.affiliation);
      })
      .catch((err) => !cancelled && setError(friendlyErrorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const orcidValue = orcid.trim() ? normalizeOrcid(orcid) : "";
  const orcidInvalid = orcidValue === null;

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!profile || orcidInvalid) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const next = await saveProfile(userId, { ...profile, fullName, orcid: orcidValue ?? "", affiliation });
      setProfile(next);
      setOrcid(next.orcid);
      setSaved(true);
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className={`${cardBase} p-6 max-w-2xl`}>
      <h2 className="text-base font-semibold text-ink mb-1">Profile</h2>
      <p className="text-sm text-muted mb-5">
        New papers start with you as the first author, using these details. Papers you already have aren't changed.
      </p>

      <div className="space-y-4">
        <div>
          <label htmlFor="profile-name" className={labelBase}>
            Name as it appears on papers
          </label>
          <input
            id="profile-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            maxLength={MAX_NAME}
            autoComplete="name"
            placeholder="e.g. Ana M. Díaz"
            disabled={!profile}
            className={inputBase}
          />
        </div>
        <div>
          <label htmlFor="profile-affiliation" className={labelBase}>
            Affiliation
          </label>
          <textarea
            id="profile-affiliation"
            value={affiliation}
            onChange={(e) => setAffiliation(e.target.value)}
            maxLength={MAX_AFFILIATION}
            rows={2}
            placeholder="Dept. of Electrical Engineering, University, City, Country"
            disabled={!profile}
            className={`${inputBase} resize-y`}
          />
        </div>
        <div>
          <label htmlFor="profile-orcid" className={labelBase}>
            ORCID iD
          </label>
          <input
            id="profile-orcid"
            value={orcid}
            onChange={(e) => setOrcid(e.target.value)}
            placeholder="0000-0002-1825-0097"
            aria-invalid={orcidInvalid}
            aria-describedby="profile-orcid-hint"
            disabled={!profile}
            className={`${inputBase} max-w-xs font-mono`}
          />
          <p id="profile-orcid-hint" className={`text-xs mt-1 ${orcidInvalid ? "text-red-600 dark:text-red-400" : "text-muted"}`}>
            {orcidInvalid
              ? "That isn't a valid ORCID iD. Check the 16 characters, including the last one."
              : "Optional. Paste the number or your orcid.org link."}
          </p>
        </div>
      </div>

      {fullName.trim() && (
        <div className="mt-5 rounded-md border border-line bg-canvas px-4 py-3 text-center font-serif">
          <p className="text-[11px] uppercase tracking-wide text-muted font-sans mb-1">Author block preview</p>
          <p className="text-sm text-ink">{fullName.trim()}</p>
          {affiliation.trim() && <p className="text-xs italic text-ink whitespace-pre-line">{affiliation.trim()}</p>}
          {email && <p className="text-xs text-ink">{email}</p>}
        </div>
      )}

      <div className="mt-5 flex items-center gap-3">
        <button type="submit" disabled={!profile || saving || orcidInvalid} className={btnPrimary}>
          {saving ? "Saving…" : "Save profile"}
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
