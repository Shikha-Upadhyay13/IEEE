import { describe, expect, it, vi } from "vitest";
import type { Session } from "@supabase/supabase-js";

vi.mock("../supabaseClient", () => ({ supabase: {} }));

import { isTotpCode, needsSecondFactor, sessionAal } from "./mfa";

const token = (claims: object) =>
  `h.${btoa(JSON.stringify(claims)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}.s`;

const session = (aal: string, factors: { factor_type: string; status: string }[]) =>
  ({ access_token: token({ aal }), user: { factors } }) as unknown as Session;

describe("sessionAal", () => {
  it("reads the level from the token, and tolerates junk", () => {
    expect(sessionAal(token({ aal: "aal2", sub: "ü" }))).toBe("aal2");
    expect(sessionAal("not-a-jwt")).toBeNull();
    expect(sessionAal(undefined)).toBeNull();
  });
});

describe("needsSecondFactor", () => {
  it("asks for a code only when a verified authenticator exists and it wasn't used", () => {
    const verified = [{ factor_type: "totp", status: "verified" }];
    expect(needsSecondFactor(session("aal1", verified))).toBe(true);
    expect(needsSecondFactor(session("aal2", verified))).toBe(false);
    expect(needsSecondFactor(session("aal1", [{ factor_type: "totp", status: "unverified" }]))).toBe(false);
    expect(needsSecondFactor(session("aal1", []))).toBe(false);
    expect(needsSecondFactor(null)).toBe(false);
  });
});

describe("isTotpCode", () => {
  it("accepts six digits, with spaces", () => {
    expect(isTotpCode("123 456")).toBe(true);
    expect(isTotpCode("12345")).toBe(false);
    expect(isTotpCode("12345a")).toBe(false);
  });
});
