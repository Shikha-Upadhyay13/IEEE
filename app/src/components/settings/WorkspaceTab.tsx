import { useEffect, useState } from "react";
import { cardBase, inputBase, labelBase } from "../../lib/uiClasses";
import { useWorkspaceStore } from "../../store/workspaceStore";
import { WorkspaceMembers } from "../dashboard/WorkspaceMembers";

export function WorkspaceTab({ userId }: { userId: string }) {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const currentId = useWorkspaceStore((s) => s.currentId);
  const load = useWorkspaceStore((s) => s.load);
  const error = useWorkspaceStore((s) => s.error);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    void load(userId);
  }, [userId, load]);

  const selected = workspaces.find((w) => w.id === (selectedId ?? currentId)) ?? null;

  return (
    <div className={`${cardBase} p-6 max-w-2xl`}>
      <h2 className="text-base font-semibold text-ink mb-1">Workspace</h2>
      <p className="text-sm text-muted mb-4">
        Members, roles, pending invitations and shared templates. Create a team workspace from the switcher in the
        sidebar.
      </p>

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 mb-3" role="alert">
          {error}
        </p>
      )}

      {workspaces.length > 1 && (
        <div className="mb-4">
          <label htmlFor="settings-workspace" className={labelBase}>
            Workspace
          </label>
          <select
            id="settings-workspace"
            value={selected?.id ?? ""}
            onChange={(e) => setSelectedId(e.target.value)}
            className={`${inputBase} max-w-xs cursor-pointer`}
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
                {w.personal ? " (personal)" : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {!selected ? (
        <p className="text-sm text-muted">Loading workspaces…</p>
      ) : selected.personal ? (
        <p className="text-sm text-muted">
          <span className="font-medium text-ink">{selected.name}</span> is just you. Share a single paper from its Share
          button, or create a team workspace to collaborate with a group.
        </p>
      ) : (
        <div className="rounded-md border border-line">
          <WorkspaceMembers
            key={selected.id}
            workspace={selected}
            userId={userId}
            onLeft={() => {
              setSelectedId(null);
              void load(userId);
            }}
          />
        </div>
      )}
    </div>
  );
}
