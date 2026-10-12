import { useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { btnPrimary, btnSecondary, cardBase, inputBase, labelBase } from "../../lib/uiClasses";
import { friendlyErrorMessage } from "../../lib/friendlyError";
import { formatJoinDate } from "../../lib/formatJoinDate";
import { changeEmail, changePassword, passwordProblem, signOutOtherSessions } from "../../lib/accountSecurity";
import { isEmail } from "../../lib/sharing";

type Status = { kind: "ok" | "error"; text: string } | null;

function StatusLine({ status }: { status: Status }) {
  if (!status) return null;
  return (
    <p
      role={status.kind === "error" ? "alert" : "status"}
      className={`text-xs mt-2 ${status.kind === "error" ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}
    >
      {status.text}
    </p>
  );
}

function EmailSection({ user }: { user: User }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      await changeEmail(email);
      setStatus({ kind: "ok", text: `Confirm the change from the links sent to ${user.email} and ${email.trim()}.` });
      setEmail("");
    } catch (err) {
      setStatus({ kind: "error", text: friendlyErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <h3 className="text-sm font-semibold text-ink mb-1">Email</h3>
      <p className="text-sm text-muted mb-3">
        Signed in as <span className="text-ink">{user.email}</span>
        {user.new_email && (
          <>
            {" "}
            — waiting for you to confirm <span className="text-ink">{user.new_email}</span>
          </>
        )}
        .
      </p>
      <label htmlFor="account-email" className={labelBase}>
        New email
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id="account-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          className={`${inputBase} max-w-xs`}
        />
        <button type="submit" disabled={busy || !isEmail(email) || email.trim() === user.email} className={btnSecondary}>
          {busy ? "Sending…" : "Change email"}
        </button>
      </div>
      <StatusLine status={status} />
    </form>
  );
}

function PasswordSection() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const problem = password || confirm ? passwordProblem(password, confirm) : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (passwordProblem(password, confirm)) return;
    setBusy(true);
    setStatus(null);
    try {
      const result = await changePassword(password, code?.trim() || undefined);
      if (result === "needs-code") {
        setCode("");
        setStatus({ kind: "ok", text: "For your security, enter the code we just emailed you, then save again." });
      } else {
        setPassword("");
        setConfirm("");
        setCode(null);
        setStatus({ kind: "ok", text: "Password changed." });
      }
    } catch (err) {
      setStatus({ kind: "error", text: friendlyErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <h3 className="text-sm font-semibold text-ink mb-3">Password</h3>
      <div className="grid sm:grid-cols-2 gap-3 max-w-lg">
        <div>
          <label htmlFor="account-password" className={labelBase}>
            New password
          </label>
          <input
            id="account-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            className={inputBase}
          />
        </div>
        <div>
          <label htmlFor="account-password-confirm" className={labelBase}>
            Type it again
          </label>
          <input
            id="account-password-confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            className={inputBase}
          />
        </div>
        {code !== null && (
          <div>
            <label htmlFor="account-password-code" className={labelBase}>
              Code from email
            </label>
            <input
              id="account-password-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              className={`${inputBase} font-mono`}
            />
          </div>
        )}
      </div>
      {problem && <p className="text-xs text-muted mt-2">{problem}</p>}
      <button type="submit" disabled={busy || problem !== null || !password} className={`${btnSecondary} mt-3`}>
        {busy ? "Saving…" : "Change password"}
      </button>
      <StatusLine status={status} />
    </form>
  );
}

function SessionsSection() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  async function signOutOthers() {
    setBusy(true);
    setStatus(null);
    try {
      await signOutOtherSessions();
      setStatus({ kind: "ok", text: "Signed out everywhere else. This browser stays signed in." });
    } catch (err) {
      setStatus({ kind: "error", text: friendlyErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-ink mb-1">Other devices</h3>
      <p className="text-sm text-muted mb-3">
        Lost a laptop or signed in on a shared computer? End every session except this one.
      </p>
      <button type="button" onClick={signOutOthers} disabled={busy} className={btnSecondary}>
        {busy ? "Signing out…" : "Sign out other sessions"}
      </button>
      <StatusLine status={status} />
    </div>
  );
}

export function AccountTab({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  return (
    <div className="space-y-6 max-w-2xl">
      <div className={`${cardBase} p-6 flex flex-wrap items-center gap-4`}>
        <div className="w-14 h-14 rounded-full bg-accent text-accent-fg flex items-center justify-center text-xl font-semibold flex-none">
          {user.email?.[0]?.toUpperCase() ?? "?"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-ink truncate">{user.email ?? "Your account"}</p>
          <p className="text-sm text-muted">Member since {formatJoinDate(user.created_at)}</p>
        </div>
        <button onClick={onSignOut} className={btnPrimary}>
          Sign out
        </button>
      </div>

      <div className={`${cardBase} p-6 space-y-6 [&>*+*]:border-t [&>*+*]:border-line [&>*+*]:pt-6`}>
        <EmailSection user={user} />
        <PasswordSection />
        <SessionsSection />
      </div>
    </div>
  );
}
