import { supabase } from "../supabaseClient";
import { updateDocument } from "./documentWrites";
import type { PaperRole } from "./sharing";

export type PaperView = "mine" | "shared" | "workspace" | "archived" | "trash";

export const PAPER_VIEWS: { id: PaperView; label: string; empty: string }[] = [
  { id: "mine", label: "My papers", empty: "" },
  { id: "shared", label: "Shared with me", empty: "Papers other people invite you to will show up here." },
  { id: "workspace", label: "Workspace", empty: "No papers here yet. Owners share a paper with the workspace from its Share menu." },
  { id: "archived", label: "Archived", empty: "Archive finished papers to keep this list short — they stay searchable here." },
  { id: "trash", label: "Trash", empty: "Nothing in Trash. Papers you move here can be restored for 30 days." },
];

export function parsePaperView(value: string | null): PaperView {
  return PAPER_VIEWS.some((v) => v.id === value) ? (value as PaperView) : "mine";
}

export type PaperRow = { id: string; title: string | null; updated_at: string; role: PaperRole };

type Row = { id: string; title: string | null; updated_at: string };
type WorkspaceRow = Row & { owner_id: string; workspace_access: "private" | "view" | "edit" };

/**
 * Filters by owner explicitly: public papers are readable by anyone, so
 * row-level security alone would mix other people's shared papers in.
 */
export async function loadPapers(view: PaperView, userId: string, workspaceId?: string | null): Promise<PaperRow[]> {
  if (view === "shared") return loadShared(userId);
  if (view === "workspace") return workspaceId ? loadWorkspace(userId, workspaceId) : [];

  let query = supabase.from("documents").select("id, title, updated_at").eq("owner_id", userId);
  if (view === "trash") query = query.not("deleted_at", "is", null);
  else {
    query = query.is("deleted_at", null);
    query = view === "archived" ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  }
  const { data, error } = await query.order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map((d) => ({ ...d, role: "owner" }));
}

async function loadShared(userId: string): Promise<PaperRow[]> {
  const { data: memberships, error } = await supabase
    .from("document_members")
    .select("document_id, role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  if (!memberships?.length) return [];

  const roles = new Map(memberships.map((m) => [m.document_id as string, m.role as PaperRole]));
  const { data, error: docsError } = await supabase
    .from("documents")
    .select("id, title, updated_at")
    .in("id", [...roles.keys()])
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });
  if (docsError) throw new Error(docsError.message);
  return ((data ?? []) as Row[]).map((d) => ({ ...d, role: roles.get(d.id) ?? "viewer" }));
}

/** Papers filed in a workspace that the user can open: their own, plus ones shared with the workspace. */
async function loadWorkspace(userId: string, workspaceId: string): Promise<PaperRow[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("id, title, updated_at, owner_id, workspace_access")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .is("archived_at", null)
    .or(`owner_id.eq.${userId},workspace_access.neq.private`)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as WorkspaceRow[]).map(({ owner_id, workspace_access, ...d }) => ({
    ...d,
    role: workspaceRole(owner_id === userId, workspace_access),
  }));
}

export function workspaceRole(isOwner: boolean, access: WorkspaceRow["workspace_access"]): PaperRole {
  if (isOwner) return "owner";
  return access === "edit" ? "editor" : "viewer";
}

export function setArchived(id: string, archived: boolean) {
  return updateDocument(id, { archived_at: archived ? new Date().toISOString() : null });
}

export function setTrashed(id: string, trashed: boolean) {
  return updateDocument(id, { deleted_at: trashed ? new Date().toISOString() : null });
}
