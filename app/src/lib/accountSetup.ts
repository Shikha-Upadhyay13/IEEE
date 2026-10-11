import { acceptMyInvitations } from "./sharing";

const done = new Set<string>();

/**
 * Once per signed-in user per page load: turn pending paper and workspace
 * invitations into access. Failures are logged, never shown.
 */
export function runAccountSetup(userId: string) {
  if (done.has(userId)) return;
  done.add(userId);
  // Deferred: supabase-js deadlocks if called from inside onAuthStateChange.
  window.setTimeout(() => {
    acceptMyInvitations().catch((err) => console.warn("Accepting invitations failed:", err));
  }, 0);
}
