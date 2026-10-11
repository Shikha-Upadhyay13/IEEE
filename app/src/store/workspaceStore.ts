import { create } from "zustand";
import { supabase } from "../supabaseClient";

export type WorkspaceRole = "owner" | "admin" | "member";
export type Workspace = { id: string; name: string; personal: boolean; role: WorkspaceRole };

const storageKey = (userId: string) => `ieee_workspace_${userId}`;

type WorkspaceState = {
  userId: string | null;
  workspaces: Workspace[];
  currentId: string | null;
  loading: boolean;
  error: string | null;
  load: (userId: string) => Promise<void>;
  select: (id: string) => void;
  create: (name: string) => Promise<string>;
};

/** Personal first, then team workspaces by name. */
export function sortWorkspaces(list: Workspace[]): Workspace[] {
  return list.toSorted((a, b) => Number(b.personal) - Number(a.personal) || a.name.localeCompare(b.name));
}

/** The remembered workspace if it still exists, otherwise the personal one. */
export function pickCurrent(list: Workspace[], remembered: string | null): string | null {
  if (remembered && list.some((w) => w.id === remembered)) return remembered;
  return (list.find((w) => w.personal) ?? list[0])?.id ?? null;
}

let inflight: { userId: string; promise: Promise<void> } | null = null;

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  userId: null,
  workspaces: [],
  currentId: null,
  loading: false,
  error: null,

  load(userId) {
    // Several components ask at once; one round trip serves them all.
    if (inflight?.userId === userId) return inflight.promise;
    const promise = fetchWorkspaces(userId).finally(() => {
      if (inflight?.promise === promise) inflight = null;
    });
    inflight = { userId, promise };
    return promise;
  },

  select(id) {
    const { userId } = get();
    if (userId) localStorage.setItem(storageKey(userId), id);
    set({ currentId: id });
  },

  async create(name) {
    const { data, error } = await supabase.rpc("create_workspace", { workspace_name: name.trim() });
    if (error) throw new Error(error.message);
    const id = data as string;
    const { userId } = get();
    if (userId) await get().load(userId);
    get().select(id);
    return id;
  },
}));

async function fetchWorkspaces(userId: string) {
  const set = useWorkspaceStore.setState;
  set({ userId, loading: true, error: null });
  // Creates the personal workspace on first use and files unfiled papers into it.
  const { error: ensureError } = await supabase.rpc("ensure_personal_workspace");
  if (ensureError) console.warn("Personal workspace setup failed:", ensureError.message);
  const { data, error } = await supabase
    .from("workspace_members")
    .select("role, workspaces(id, name, personal)")
    .eq("user_id", userId);
  if (error) {
    set({ loading: false, error: error.message });
    return;
  }
  const workspaces = sortWorkspaces(
    (data ?? []).flatMap((row) => {
      const ws = row.workspaces as unknown as Omit<Workspace, "role"> | null;
      return ws ? [{ ...ws, role: row.role as WorkspaceRole }] : [];
    })
  );
  set({ workspaces, currentId: pickCurrent(workspaces, localStorage.getItem(storageKey(userId))), loading: false });
}

export function currentWorkspace(state: Pick<WorkspaceState, "workspaces" | "currentId">): Workspace | null {
  return state.workspaces.find((w) => w.id === state.currentId) ?? null;
}
