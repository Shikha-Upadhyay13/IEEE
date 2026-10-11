import { useCallback, useEffect, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { useAuth } from "../../lib/useAuth";
import {
  MEMBER_ROLES,
  changeRole,
  invitePerson,
  isEmail,
  listInvitations,
  listPeople,
  removePerson,
  revokeInvitation,
  type MemberRole,
  type PendingInvitation,
  type Person,
} from "../../lib/sharing";
import { friendlyErrorMessage } from "../../lib/friendlyError";
import { btnPrimary, inputBase } from "../../lib/uiClasses";

const ROLE_LABEL: Record<Person["role"], string> = { owner: "Owner", editor: "Editor", reviewer: "Reviewer", viewer: "Viewer" };

/** Invite by email and manage who can open the paper. Owners manage; everyone else sees the list. */
export function SharePeople({ documentId, onOwnerChange }: { documentId: string; onOwnerChange?: (isOwner: boolean) => void }) {
  const { user } = useAuth();
  const [people, setPeople] = useState<Person[] | null>(null);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("editor");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const isOwner = people?.some((p) => p.role === "owner" && p.userId === user?.id) ?? false;

  const refresh = useCallback(async () => {
    try {
      const nextPeople = await listPeople(documentId);
      setPeople(nextPeople);
      const owner = nextPeople.some((p) => p.role === "owner" && p.userId === user?.id);
      onOwnerChange?.(owner);
      setInvitations(owner ? await listInvitations(documentId) : []);
    } catch (err) {
      setMessage({ kind: "error", text: `Couldn't load who has access. ${friendlyErrorMessage(err)}` });
    }
  }, [documentId, user?.id, onOwnerChange]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      await refresh();
    } catch (err) {
      setMessage({ kind: "error", text: friendlyErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  function handleInvite(e: FormEvent) {
    e.preventDefault();
    if (!isEmail(email)) {
      setMessage({ kind: "error", text: "Enter a valid email address." });
      return;
    }
    const address = email.trim();
    void run(async () => {
      const result = await invitePerson(documentId, address, role);
      setEmail("");
      const roleLabel = ROLE_LABEL[role].toLowerCase();
      setMessage({
        kind: "ok",
        text:
          result === "added"
            ? `${address} can now open this paper as ${roleLabel === "editor" ? "an" : "a"} ${roleLabel}.`
            : `Invitation saved. ${address} gets access as soon as they sign up with that email — let them know.`,
      });
    });
  }

  return (
    <div className="py-3 border-b border-line">
      <p className="text-xs font-medium text-ink">People with access</p>

      {isOwner && (
        <form onSubmit={handleInvite} className="mt-2 flex gap-1.5">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="co-author@university.edu"
            aria-label="Email to invite"
            className={`${inputBase} text-xs py-1.5 min-w-0 flex-1`}
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as MemberRole)}
            aria-label="Role for the invited person"
            className={`${inputBase} text-xs py-1.5 w-auto cursor-pointer`}
          >
            {MEMBER_ROLES.map((r) => (
              <option key={r.id} value={r.id} title={r.description}>
                {r.label}
              </option>
            ))}
          </select>
          <button type="submit" disabled={busy || !email.trim()} className={`${btnPrimary} text-xs py-1.5 px-2.5 flex-none`}>
            Invite
          </button>
        </form>
      )}

      {message && (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={`mt-2 text-[11px] ${message.kind === "error" ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}
        >
          {message.text}
        </p>
      )}

      {people === null ? (
        <p className="mt-2 text-[11px] text-muted">Loading…</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {people.map((p) => (
            <li key={p.userId} className="flex items-center gap-2 text-xs">
              <span className="min-w-0 flex-1 truncate text-ink" title={p.email}>
                {p.email}
                {p.userId === user?.id && <span className="text-muted"> (you)</span>}
              </span>
              {isOwner && p.role !== "owner" ? (
                <>
                  <select
                    value={p.role}
                    disabled={busy}
                    onChange={(e) => void run(() => changeRole(documentId, p.userId, e.target.value as MemberRole))}
                    aria-label={`Role for ${p.email}`}
                    className="bg-transparent text-xs text-muted cursor-pointer"
                  >
                    {MEMBER_ROLES.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void run(() => removePerson(documentId, p.userId))}
                    aria-label={`Remove ${p.email}`}
                    className="text-muted hover:text-ink"
                  >
                    <X size={13} aria-hidden="true" />
                  </button>
                </>
              ) : (
                <span className="text-muted">{ROLE_LABEL[p.role]}</span>
              )}
            </li>
          ))}
          {invitations.map((inv) => (
            <li key={inv.id} className="flex items-center gap-2 text-xs">
              <span className="min-w-0 flex-1 truncate text-muted" title={inv.email}>
                {inv.email} <span className="italic">(invited)</span>
              </span>
              <span className="text-muted">{ROLE_LABEL[inv.role]}</span>
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(() => revokeInvitation(inv.id))}
                aria-label={`Cancel invitation for ${inv.email}`}
                className="text-muted hover:text-ink"
              >
                <X size={13} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
