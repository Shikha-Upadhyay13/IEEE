import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, Check, ChevronsUpDown, Plus, Users } from "lucide-react";
import { Popover } from "../ui/Popover";
import { useAuth } from "../../lib/useAuth";
import { currentWorkspace, useWorkspaceStore } from "../../store/workspaceStore";
import { friendlyErrorMessage } from "../../lib/friendlyError";
import { btnPrimary, inputBase } from "../../lib/uiClasses";
import { WorkspaceMembers } from "./WorkspaceMembers";

type Panel = "list" | "create" | "members";

export function WorkspaceSwitcher() {
  const { user } = useAuth();
  const { workspaces, currentId, load, select, create } = useWorkspaceStore();
  const current = currentWorkspace({ workspaces, currentId });
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>("list");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (user) void load(user.id);
  }, [user, load]);

  function close() {
    setOpen(false);
    setPanel("list");
    setError(null);
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await create(name);
      setName("");
      setPanel("members");
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!user || workspaces.length === 0) return null;

  return (
    <div className="mb-4">
      <button
        ref={anchorRef}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="w-full flex items-center gap-2 rounded-lg border border-line px-2.5 py-2 text-left text-sm hover:bg-canvas transition-colors"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] uppercase tracking-wide text-muted">Workspace</span>
          <span className="block truncate font-medium text-ink">{current?.name ?? "Personal"}</span>
        </span>
        <ChevronsUpDown size={14} className="flex-none text-muted" aria-hidden="true" />
      </button>

      <Popover open={open} onClose={close} anchorRef={anchorRef} width={320} labelledBy="workspace-switcher-title">
        <div className="flex items-center gap-2 border-b border-line px-3 py-2">
          {panel !== "list" && (
            <button type="button" onClick={() => setPanel("list")} aria-label="Back to workspaces" className="text-muted hover:text-ink">
              <ArrowLeft size={14} aria-hidden="true" />
            </button>
          )}
          <h2 id="workspace-switcher-title" className="text-xs font-semibold text-ink truncate">
            {panel === "create" ? "New workspace" : panel === "members" ? `${current?.name} members` : "Workspaces"}
          </h2>
        </div>

        {panel === "list" && (
          <div className="py-1 text-sm">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                type="button"
                onClick={() => {
                  select(ws.id);
                  close();
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-canvas"
              >
                <Check size={14} className={ws.id === currentId ? "text-accent" : "invisible"} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-ink">{ws.name}</span>
                <span className="text-[11px] text-muted capitalize">{ws.personal ? "Only you" : ws.role}</span>
              </button>
            ))}
            <div className="my-1 border-t border-line" />
            {current && !current.personal && (
              <button
                type="button"
                onClick={() => setPanel("members")}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-ink hover:bg-canvas"
              >
                <Users size={14} aria-hidden="true" />
                Members of {current.name}
              </button>
            )}
            <button
              type="button"
              onClick={() => setPanel("create")}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-ink hover:bg-canvas"
            >
              <Plus size={14} aria-hidden="true" />
              New team workspace
            </button>
          </div>
        )}

        {panel === "create" && (
          <form onSubmit={handleCreate} className="p-3 space-y-2">
            <p className="text-[11px] text-muted">
              A shared space for your lab or co-authors. Papers stay private until you share them with the workspace.
            </p>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder="e.g. Vision Lab"
              aria-label="Workspace name"
              className={`${inputBase} text-sm`}
            />
            {error && (
              <p role="alert" className="text-[11px] text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
            <button type="submit" disabled={busy || !name.trim()} className={`${btnPrimary} w-full text-sm`}>
              {busy ? "Creating…" : "Create workspace"}
            </button>
          </form>
        )}

        {panel === "members" && current && (
          <WorkspaceMembers
            workspace={current}
            userId={user.id}
            onLeft={() => {
              close();
              void load(user.id);
            }}
          />
        )}
      </Popover>
    </div>
  );
}
