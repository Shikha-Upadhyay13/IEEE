import { supabase } from "../supabaseClient";

export type PaperRole = "owner" | "editor" | "reviewer" | "viewer";
export type MemberRole = Exclude<PaperRole, "owner">;

export const MEMBER_ROLES: { id: MemberRole; label: string; description: string }[] = [
  { id: "editor", label: "Editor", description: "Edits the paper" },
  { id: "reviewer", label: "Reviewer", description: "Reads, comments and suggests changes" },
  { id: "viewer", label: "Viewer", description: "Reads only" },
];

export type Person = { userId: string; email: string; role: PaperRole };
export type PendingInvitation = { id: string; email: string; role: MemberRole; expiresAt: string };

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export async function listPeople(documentId: string): Promise<Person[]> {
  const { data, error } = await supabase.rpc("document_people", { doc_id: documentId });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: { user_id: string; email: string; role: PaperRole }) => ({
    userId: row.user_id,
    email: row.email,
    role: row.role,
  }));
}

export async function listInvitations(documentId: string): Promise<PendingInvitation[]> {
  const { data, error } = await supabase
    .from("document_invitations")
    .select("id, email, role, expires_at")
    .eq("document_id", documentId)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    email: row.email as string,
    role: row.role as MemberRole,
    expiresAt: row.expires_at as string,
  }));
}

/** "added" when the person already has an account, "invited" when they'll get access on sign-up. */
export async function invitePerson(documentId: string, email: string, role: MemberRole): Promise<"added" | "invited"> {
  const { data, error } = await supabase.rpc("invite_to_document", {
    doc_id: documentId,
    invitee_email: email.trim(),
    invitee_role: role,
  });
  if (error) throw new Error(error.message);
  return data as "added" | "invited";
}

export async function changeRole(documentId: string, userId: string, role: MemberRole) {
  const { error } = await supabase.from("document_members").update({ role }).eq("document_id", documentId).eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function removePerson(documentId: string, userId: string) {
  const { error } = await supabase.from("document_members").delete().eq("document_id", documentId).eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function revokeInvitation(id: string) {
  const { error } = await supabase.from("document_invitations").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Turns open invitations for the signed-in user's email into access. */
export async function acceptMyInvitations(): Promise<number> {
  const { data, error } = await supabase.rpc("accept_my_invitations");
  if (error) throw new Error(error.message);
  return (data as number) ?? 0;
}
