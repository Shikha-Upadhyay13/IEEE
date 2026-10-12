import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { Factor } from "@supabase/supabase-js";
import { ShieldCheck } from "lucide-react";
import { btnDanger, btnPrimary, btnSecondary, inputBase, labelBase } from "../../lib/uiClasses";
import { friendlyErrorMessage } from "../../lib/friendlyError";
import {
  isTotpCode,
  listAuthenticators,
  removeAuthenticator,
  startAuthenticatorSetup,
  verifyAuthenticator,
  type Enrollment,
} from "../../lib/mfa";
import { useConfirm } from "../ConfirmDialog";

export function TwoFactorSection() {
  const [factors, setFactors] = useState<Factor[] | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { confirm, ConfirmDialog } = useConfirm();
  const verified = (factors ?? []).filter((f) => f.status === "verified");

  const refresh = useCallback(async () => {
    try {
      setFactors(await listAuthenticators());
    } catch (err) {
      setError(friendlyErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function begin() {
    setBusy(true);
    setError(null);
    try {
      setEnrollment(await startAuthenticatorSetup());
      setCode("");
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function finish(e: FormEvent) {
    e.preventDefault();
    if (!enrollment || !isTotpCode(code)) return;
    setBusy(true);
    setError(null);
    try {
      await verifyAuthenticator(enrollment.factorId, code);
      setEnrollment(null);
      await refresh();
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(factor: Factor) {
    const last = verified.length === 1;
    const ok = await confirm({
      title: "Remove this authenticator?",
      message: last
        ? "Two-factor sign-in turns off, and your password alone will open this account again."
        : "Codes from this app will stop working. Your other authenticator keeps working.",
      confirmLabel: "Remove",
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await removeAuthenticator(factor.id);
      await refresh();
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-ink mb-1 flex items-center gap-1.5">
        Two-factor sign-in
        {verified.length > 0 && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
            <ShieldCheck size={13} aria-hidden="true" /> On
          </span>
        )}
      </h3>
      <p className="text-sm text-muted mb-3">
        After your password, ask for a 6-digit code from an authenticator app such as Google Authenticator, 1Password
        or Authy. {verified.length === 1 && "Add a second app as a backup in case you lose this phone."}
      </p>

      {verified.length > 0 && (
        <ul className="mb-3 divide-y divide-line rounded-md border border-line">
          {verified.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="text-ink truncate">{f.friendly_name ?? "Authenticator app"}</span>
              <button type="button" disabled={busy} onClick={() => remove(f)} className={btnDanger}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {enrollment ? (
        <form onSubmit={finish} className="rounded-md border border-line p-4 space-y-3">
          <p className="text-sm text-ink">Scan this with your authenticator app, then enter the code it shows.</p>
          <img src={enrollment.qrCode} alt="QR code for your authenticator app" className="w-40 h-40 bg-white p-2 rounded" />
          <p className="text-xs text-muted">
            Can't scan? Enter this key instead: <span className="font-mono text-ink break-all select-all">{enrollment.secret}</span>
          </p>
          <div>
            <label htmlFor="mfa-setup-code" className={labelBase}>
              6-digit code
            </label>
            <input
              id="mfa-setup-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              className={`${inputBase} max-w-[10rem] font-mono tracking-widest`}
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={busy || !isTotpCode(code)} className={btnPrimary}>
              {busy ? "Checking…" : "Turn on"}
            </button>
            <button type="button" onClick={() => setEnrollment(null)} className={btnSecondary}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={begin} disabled={busy || factors === null} className={btnSecondary}>
          {verified.length > 0 ? "Add another authenticator" : "Set up two-factor sign-in"}
        </button>
      )}

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 mt-2" role="alert">
          {error}
        </p>
      )}
      {ConfirmDialog}
    </div>
  );
}
