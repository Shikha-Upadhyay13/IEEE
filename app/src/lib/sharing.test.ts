import { describe, expect, it, vi, beforeEach } from "vitest";

const rpc = vi.fn();
vi.mock("../supabaseClient", () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }));

import { invitePerson, isEmail, listPeople } from "./sharing";

beforeEach(() => rpc.mockReset());

describe("isEmail", () => {
  it("accepts ordinary addresses, trimmed", () => {
    expect(isEmail("  ada@uni.ac.uk ")).toBe(true);
  });

  it("rejects missing parts and spaces", () => {
    expect(isEmail("ada")).toBe(false);
    expect(isEmail("ada@uni")).toBe(false);
    expect(isEmail("ada lovelace@uni.edu")).toBe(false);
  });
});

describe("listPeople", () => {
  it("maps rows to camelCase people", async () => {
    rpc.mockResolvedValue({ data: [{ user_id: "u1", email: "a@b.co", role: "owner" }], error: null });
    await expect(listPeople("d1")).resolves.toEqual([{ userId: "u1", email: "a@b.co", role: "owner" }]);
    expect(rpc).toHaveBeenCalledWith("document_people", { doc_id: "d1" });
  });

  it("throws the database message on error", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "not allowed" } });
    await expect(listPeople("d1")).rejects.toThrow("not allowed");
  });
});

describe("invitePerson", () => {
  it("sends a trimmed email and returns the outcome", async () => {
    rpc.mockResolvedValue({ data: "invited", error: null });
    await expect(invitePerson("d1", " x@y.org ", "reviewer")).resolves.toBe("invited");
    expect(rpc).toHaveBeenCalledWith("invite_to_document", { doc_id: "d1", invitee_email: "x@y.org", invitee_role: "reviewer" });
  });
});
