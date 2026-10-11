import { useCallback, useEffect, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { isEmail } from "../../lib/sharing";
import {
  WORKSPACE_ROLES,
  canManageWorkspace,
  changeWorkspaceRole,
  inviteToWorkspace,
  listWorkspaceInvitations,
  listWorkspacePeople,
  removeWorkspaceMember,
  revokeWorkspaceInvitation,
  type WorkspaceInvitation,
  type WorkspaceMemberRole,
  type WorkspacePerson,
} from "../../lib/workspaceMembers";
import type { Workspace } from "../../store/workspaceStore";
import { friendlyErrorMessage } from "../../lib/friendlyError";
import { btnPrimary, inputBase } from "../../lib/uiClasses";

const ROLE_LABEL: Record<WorkspacePerson["role"], string> = { owner: "Owner", admin: "Admin", member: "Member" };

export function WorkspaceMembers({ workspace, userId, onLeft }: { workspace: Workspace; userId: string; onLeft: () => void }) {
  const manage = canManageWorkspace(workspace.role);
  const [people, setPeople] = useState<WorkspacePerson[] | null>(null);
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<WorkspaceMemberRole>("member");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      setPeople(await listWorkspacePeople(workspace.id));
      setInvitations(manage ? await listWorkspaceInvitations(workspace.id) : []);
    } catch (err) {
      setMessage({ kind: "error", text: `Couldn't load members. ${friendlyErrorMessage(err)}` });
    }
  }, [workspace.id, manage]);

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
      const result = await inviteToWorkspace(workspace.id, address, role);
      setEmail("");
      setMessage({
        kind: "ok",
        text:
          result === "added"
            ? `${address} joined ${workspace.name}.`
            : `Invitation saved. ${address} joins as soon as they sign up with that email — let them know.`,
      });
    });
  }

  async function leave() {
    setBusy(true);
    try {
      await removeWorkspaceMember(workspace.id, userId);
      onLeft();
    } catch (err) {
      setMessage({ kind: "error", text: friendlyErrorMessage(err) });
      setBusy(false);
    }
  }

  return (
    <div className="p-3 text-xs">
      {manage && (
        <form onSubmit={handleInvite} className="flex gap-1.5">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="colleague@university.edu"
            aria-label="Email to invite to the workspace"
            className={`${inputBase} text-xs py-1.5 min-w-0 flex-1`}
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as WorkspaceMemberRole)}
            aria-label="Workspace role for the invited person"
            className={`${inputBase} text-xs py-1.5 w-auto cursor-pointer`}
          >
            {WORKSPACE_ROLES.map((r) => (
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
        <p className="mt-2 text-muted">Loading…</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {people.map((p) => (
            <li key={p.userId} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-ink" title={p.email}>
                {p.email}
                {p.userId === userId && <span className="text-muted"> (you)</span>}
              </span>
              {manage && p.role !== "owner" && p.userId !== userId ? (
                <>
                  <select
                    value={p.role}
                    disabled={busy}
                    onChange={(e) => void run(() => changeWorkspaceRole(workspace.id, p.userId, e.target.value as WorkspaceMemberRole))}
                    aria-label={`Workspace role for ${p.email}`}
                    className="bg-transparent text-xs text-muted cursor-pointer"
                  >
                    {WORKSPACE_ROLES.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void run(() => removeWorkspaceMember(workspace.id, p.userId))}
                    aria-label={`Remove ${p.email} from the workspace`}
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
            <li key={inv.id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-muted" title={inv.email}>
                {inv.email} <span className="italic">(invited)</span>
              </span>
              <span className="text-muted">{ROLE_LABEL[inv.role]}</span>
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(() => revokeWorkspaceInvitation(inv.id))}
                aria-label={`Cancel invitation for ${inv.email}`}
                className="text-muted hover:text-ink"
              >
                <X size={13} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {workspace.role !== "owner" && (
        <button type="button" disabled={busy} onClick={leave} className="mt-3 text-red-600 dark:text-red-400 hover:underline">
          Leave {workspace.name}
        </button>
      )}
    </div>
  );
}
