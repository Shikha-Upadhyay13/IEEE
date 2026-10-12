import type { Factor, Session } from "@supabase/supabase-js";
import { supabase } from "../supabaseClient";

/** The assurance level in a session's access token: aal2 once a second factor was verified. */
export function sessionAal(accessToken: string | undefined): string | null {
  const payload = accessToken?.split(".")[1];
  if (!payload) return null;
  try {
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const aal = (JSON.parse(json) as { aal?: unknown }).aal;
    return typeof aal === "string" ? aal : null;
  } catch {
    return null;
  }
}

/** Signed in with a password but not yet with the authenticator app the account requires. */
export function needsSecondFactor(session: Session | null): boolean {
  if (!session) return false;
  const enrolled = session.user.factors?.some((f) => f.factor_type === "totp" && f.status === "verified") ?? false;
  return enrolled && sessionAal(session.access_token) !== "aal2";
}

export function cleanCode(code: string): string {
  return code.replace(/\s/g, "");
}

export function isTotpCode(code: string): boolean {
  return /^\d{6}$/.test(cleanCode(code));
}

export async function listAuthenticators(): Promise<Factor[]> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  return data.totp;
}

export type Enrollment = { factorId: string; qrCode: string; secret: string };

/** Abandoned set-ups are cleared first; Supabase refuses a second unverified factor. */
export async function startAuthenticatorSetup(): Promise<Enrollment> {
  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError) throw listError;
  for (const f of factors.all) {
    if (f.factor_type === "totp" && f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `Authenticator ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
  });
  if (error) throw error;
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

export async function verifyAuthenticator(factorId: string, code: string) {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: cleanCode(code) });
  if (error) throw error;
}

/** The sign-in step: any of the account's verified authenticators will do. */
export async function verifySignInCode(code: string) {
  const factors = await listAuthenticators();
  const factor = factors.find((f) => f.status === "verified");
  if (!factor) throw new Error("This account has no authenticator app set up.");
  await verifyAuthenticator(factor.id, code);
}

export async function removeAuthenticator(factorId: string) {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw error;
}
