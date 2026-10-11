import { supabase } from "../supabaseClient";

export type NotificationKind =
  | "paper_shared"
  | "workspace_added"
  | "mention"
  | "reply"
  | "comment"
  | "suggestion"
  | "suggestion_decided";

export type Notification = {
  id: string;
  kind: NotificationKind;
  documentId: string | null;
  workspaceId: string | null;
  actorId: string | null;
  payload: { title?: string; workspace?: string; role?: string; excerpt?: string; status?: string; actor?: string };
  readAt: string | null;
  createdAt: string;
};

type Row = {
  id: string;
  kind: NotificationKind;
  document_id: string | null;
  workspace_id: string | null;
  actor_id: string | null;
  payload: Notification["payload"] | null;
  read_at: string | null;
  created_at: string;
};

export const NOTIFICATION_COLUMNS = "id, kind, document_id, workspace_id, actor_id, payload, read_at, created_at";

export function fromRow(r: Row): Notification {
  return {
    id: r.id,
    kind: r.kind,
    documentId: r.document_id,
    workspaceId: r.workspace_id,
    actorId: r.actor_id,
    payload: r.payload ?? {},
    readAt: r.read_at,
    createdAt: r.created_at,
  };
}

/** One line describing what happened, without the actor (the inbox shows who separately). */
export function describe(n: Notification): string {
  const title = `“${n.payload.title ?? "a paper"}”`;
  switch (n.kind) {
    case "paper_shared":
      return `shared ${title} with you${n.payload.role ? ` as ${n.payload.role}` : ""}`;
    case "workspace_added":
      return n.payload.workspace ? `added you to the ${n.payload.workspace} workspace` : "added you to a workspace";
    case "mention":
      return `mentioned you in ${title}`;
    case "reply":
      return `replied in a thread on ${title}`;
    case "comment":
      return `commented on ${title}`;
    case "suggestion":
      return `suggested an edit to ${title}`;
    case "suggestion_decided":
      return `${n.payload.status === "accepted" ? "accepted" : "declined"} your suggestion on ${title}`;
  }
}

/** Where clicking a notification takes you. The editor sends read-only roles on to the view page. */
export function destination(n: Notification): string {
  return n.documentId ? `/editor/${n.documentId}` : "/dashboard";
}

export async function listNotifications(limit = 50): Promise<Notification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select(NOTIFICATION_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map(fromRow);
}

export async function markRead(ids: string[]) {
  if (ids.length === 0) return;
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids).is("read_at", null);
  if (error) throw new Error(error.message);
}

export async function markAllRead() {
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  if (error) throw new Error(error.message);
}
