import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../lib/useAuth";
import { updateDocument } from "../../lib/documentWrites";
import { friendlyErrorMessage } from "../../lib/friendlyError";
import { useWorkspaceStore } from "../../store/workspaceStore";

type Access = "private" | "view" | "edit";

const ACCESS_OPTIONS: { id: Access; label: string }[] = [
  { id: "private", label: "Only people listed above" },
  { id: "view", label: "Everyone in the workspace can view" },
  { id: "edit", label: "Everyone in the workspace can edit" },
];

/** Owner-only: which workspace the paper is filed in, and what its members can do. */
export function ShareWorkspace({ documentId }: { documentId: string }) {
  const { user } = useAuth();
  const { workspaces, load } = useWorkspaceStore();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [access, setAccess] = useState<Access>("private");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && workspaces.length === 0) void load(user.id);
  }, [user, workspaces.length, load]);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("documents")
      .select("workspace_id, workspace_access")
      .eq("id", documentId)
      .single()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setWorkspaceId(data.workspace_id as string | null);
        setAccess(data.workspace_access as Access);
      });
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  const filed = workspaces.find((w) => w.id === workspaceId);

  async function save(patch: { workspace_id?: string; workspace_access?: Access }) {
    const previous = { workspaceId, access };
    if (patch.workspace_id) setWorkspaceId(patch.workspace_id);
    if (patch.workspace_access) setAccess(patch.workspace_access);
    setBusy(true);
    setError(null);
    const { error: writeError } = await updateDocument(documentId, patch);
    setBusy(false);
    if (writeError) {
      setWorkspaceId(previous.workspaceId);
      setAccess(previous.access);
      setError(friendlyErrorMessage(writeError));
    }
  }

  if (workspaces.length < 2) return null;

  return (
    <div className="py-3 border-b border-line space-y-2">
      <p className="text-xs font-medium text-ink">Workspace</p>
      <select
        value={workspaceId ?? ""}
        disabled={busy}
        onChange={(e) => {
          const next = workspaces.find((w) => w.id === e.target.value);
          // A personal workspace has nobody else in it to share with.
          void save({ workspace_id: e.target.value, ...(next?.personal ? { workspace_access: "private" as const } : {}) });
        }}
        aria-label="Workspace this paper belongs to"
        className="w-full bg-canvas border border-line rounded-md px-2 py-1.5 text-xs text-ink cursor-pointer"
      >
        {!filed && <option value="">Not in a workspace</option>}
        {workspaces.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>
      {filed && !filed.personal && (
        <select
          value={access}
          disabled={busy}
          onChange={(e) => void save({ workspace_access: e.target.value as Access })}
          aria-label={`What members of ${filed.name} can do`}
          className="w-full bg-canvas border border-line rounded-md px-2 py-1.5 text-xs text-ink cursor-pointer"
        >
          {ACCESS_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      )}
      {error && (
        <p role="alert" className="text-[11px] text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
