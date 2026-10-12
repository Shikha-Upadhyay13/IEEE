import { describe, expect, it, vi } from "vitest";

vi.mock("../supabaseClient", () => ({ supabase: {} }));

import { passwordProblem } from "./accountSecurity";

describe("passwordProblem", () => {
  it("asks for a long enough password, typed the same twice", () => {
    expect(passwordProblem("short", "short")).toMatch(/at least 8/);
    expect(passwordProblem("long enough", "long enougj")).toMatch(/don't match/);
    expect(passwordProblem("long enough", "long enough")).toBeNull();
  });
});
