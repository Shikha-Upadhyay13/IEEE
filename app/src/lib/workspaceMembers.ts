import { supabase } from "../supabaseClient";
import type { WorkspaceRole } from "../store/workspaceStore";

export type WorkspaceMemberRole = Exclude<WorkspaceRole, "owner">;
export type WorkspacePerson = { userId: string; email: string; role: WorkspaceRole };
export type WorkspaceInvitation = { id: string; email: string; role: WorkspaceMemberRole };

export const WORKSPACE_ROLES: { id: WorkspaceMemberRole; label: string; description: string }[] = [
  { id: "member", label: "Member", description: "Sees papers shared with the workspace" },
  { id: "admin", label: "Admin", description: "Also manages members and templates" },
];

export const canManageWorkspace = (role: WorkspaceRole | undefined) => role === "owner" || role === "admin";

export async function listWorkspacePeople(workspaceId: string): Promise<WorkspacePerson[]> {
  const { data, error } = await supabase.rpc("workspace_people", { ws: workspaceId });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: { user_id: string; email: string; role: WorkspaceRole }) => ({
    userId: row.user_id,
    email: row.email,
    role: row.role,
  }));
}

export async function listWorkspaceInvitations(workspaceId: string): Promise<WorkspaceInvitation[]> {
  const { data, error } = await supabase
    .from("workspace_invitations")
    .select("id, email, role")
    .eq("workspace_id", workspaceId)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as WorkspaceInvitation[];
}

export async function inviteToWorkspace(workspaceId: string, email: string, role: WorkspaceMemberRole): Promise<"added" | "invited"> {
  const { data, error } = await supabase.rpc("invite_to_workspace", {
    ws: workspaceId,
    invitee_email: email.trim(),
    invitee_role: role,
  });
  if (error) throw new Error(error.message);
  return data as "added" | "invited";
}

export async function changeWorkspaceRole(workspaceId: string, userId: string, role: WorkspaceMemberRole) {
  const { error } = await supabase.from("workspace_members").update({ role }).eq("workspace_id", workspaceId).eq("user_id", userId);
  if (error) throw new Error(error.message);
}

/** Removes someone, or leaves the workspace when `userId` is yourself. */
export async function removeWorkspaceMember(workspaceId: string, userId: string) {
  const { error } = await supabase.from("workspace_members").delete().eq("workspace_id", workspaceId).eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function revokeWorkspaceInvitation(id: string) {
  const { error } = await supabase.from("workspace_invitations").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
