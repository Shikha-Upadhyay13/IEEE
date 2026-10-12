import { supabase } from "../supabaseClient";

export const MIN_PASSWORD = 8;

/** Why a new password can't be used yet, or null when it can. */
export function passwordProblem(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (password !== confirm) return "The two passwords don't match.";
  return null;
}

/** Supabase confirms the change through links sent to the old and new address. */
export async function changeEmail(email: string) {
  const { error } = await supabase.auth.updateUser(
    { email: email.trim() },
    { emailRedirectTo: `${window.location.origin}/settings?tab=account` },
  );
  if (error) throw error;
}

/**
 * With Supabase's "secure password change" on, an older sign-in needs a code
 * from email first; that case resolves to "needs-code" after sending one.
 */
export async function changePassword(password: string, nonce?: string): Promise<"changed" | "needs-code"> {
  const { error } = await supabase.auth.updateUser(nonce ? { password, nonce } : { password });
  if (!error) return "changed";
  if (!nonce && error.code === "reauthentication_needed") {
    const { error: sendError } = await supabase.auth.reauthenticate();
    if (sendError) throw sendError;
    return "needs-code";
  }
  throw error;
}

export async function signOutOtherSessions() {
  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) throw error;
}
