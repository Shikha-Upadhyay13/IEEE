import { supabase } from "../supabaseClient";
import { acceptMyInvitations } from "./sharing";

const done = new Set<string>();

/**
 * Once per signed-in user per page load: turn pending invitations into
 * access and make sure new papers sit in the user's personal workspace.
 * Failures are logged, never shown — the app works without either.
 */
export function runAccountSetup(userId: string) {
  if (done.has(userId)) return;
  done.add(userId);
  // Deferred: supabase-js deadlocks if called from inside onAuthStateChange.
  window.setTimeout(() => {
    acceptMyInvitations().catch((err) => console.warn("Accepting invitations failed:", err));
    ensurePersonalWorkspace().catch((err) => console.warn("Personal workspace setup failed:", err));
  }, 0);
}

async function ensurePersonalWorkspace() {
  const { error } = await supabase.rpc("ensure_personal_workspace");
  if (error) throw new Error(error.message);
}
