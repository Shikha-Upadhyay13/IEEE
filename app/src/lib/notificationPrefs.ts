import { supabase } from "../supabaseClient";
import type { NotificationKind } from "./notifications";

export type Channel = "in_app" | "email";
export type Preference = { kind: NotificationKind; in_app: boolean; email: boolean };
export type PaperLevel = "all" | "mentions" | "none";

/** Settings rows, in the order they're shown. */
export const NOTIFICATION_EVENTS: { kind: NotificationKind; label: string; hint: string }[] = [
  { kind: "mention", label: "Mentions", hint: "Someone @mentions you in a comment" },
  { kind: "reply", label: "Replies", hint: "A reply in a thread you're part of" },
  { kind: "comment", label: "Comments on your papers", hint: "A new comment thread on a paper you own" },
  { kind: "suggestion", label: "Suggested edits", hint: "Someone proposes an edit to a paper you own" },
  { kind: "suggestion_decided", label: "Your suggestions", hint: "An editor accepts or declines your suggestion" },
  { kind: "paper_shared", label: "Papers shared with you", hint: "You're invited to a paper" },
  { kind: "workspace_added", label: "Workspace invitations", hint: "You're added to a team workspace" },
];

export const PAPER_LEVELS: { value: PaperLevel; label: string }[] = [
  { value: "all", label: "All activity" },
  { value: "mentions", label: "Mentions and replies" },
  { value: "none", label: "Nothing" },
];

/** One row per event; anything never saved is on for both channels, as the database assumes. */
export function withDefaults(saved: Preference[]): Preference[] {
  return NOTIFICATION_EVENTS.map(
    ({ kind }) => saved.find((p) => p.kind === kind) ?? { kind, in_app: true, email: true },
  );
}

export async function loadPreferences(): Promise<Preference[]> {
  const { data, error } = await supabase.from("notification_preferences").select("kind, in_app, email");
  if (error) throw new Error(error.message);
  return withDefaults((data ?? []) as Preference[]);
}

export async function savePreference(userId: string, pref: Preference) {
  const { error } = await supabase
    .from("notification_preferences")
    .upsert({ user_id: userId, ...pref }, { onConflict: "user_id,kind" });
  if (error) throw new Error(error.message);
}

/** Whether notification email is on; there is no row until it's first changed or sent. */
export async function loadEmailEnabled(): Promise<boolean> {
  const { data, error } = await supabase.from("email_settings").select("notification_emails").maybeSingle();
  if (error) throw new Error(error.message);
  return data?.notification_emails ?? true;
}

export async function setEmailEnabled(enabled: boolean) {
  const { error } = await supabase.rpc("set_notification_emails", { enabled });
  if (error) throw new Error(error.message);
}

export async function loadPaperLevel(documentId: string): Promise<PaperLevel> {
  const { data, error } = await supabase
    .from("paper_notification_levels")
    .select("level")
    .eq("document_id", documentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.level as PaperLevel | undefined) ?? "all";
}

export async function setPaperLevel(userId: string, documentId: string, level: PaperLevel) {
  const { error } = await supabase
    .from("paper_notification_levels")
    .upsert({ user_id: userId, document_id: documentId, level }, { onConflict: "user_id,document_id" });
  if (error) throw new Error(error.message);
}

/** For the unsubscribe link in notification email; works signed out. */
export async function unsubscribe(token: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("unsubscribe_notification_emails", { token });
  if (error) throw new Error(error.message);
  return data === true;
}
