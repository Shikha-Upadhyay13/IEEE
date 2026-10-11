import { describe, expect, it, vi } from "vitest";

vi.mock("../supabaseClient", () => ({ supabase: {} }));

import { pickCurrent, sortWorkspaces, type Workspace } from "./workspaceStore";

const ws = (id: string, name: string, personal = false): Workspace => ({ id, name, personal, role: "member" });
const list = [ws("b", "Zeta Lab"), ws("p", "Personal", true), ws("a", "Alpha Group")];

describe("sortWorkspaces", () => {
  it("puts the personal workspace first, then the rest by name", () => {
    expect(sortWorkspaces(list).map((w) => w.id)).toEqual(["p", "a", "b"]);
  });
});

describe("pickCurrent", () => {
  it("keeps the remembered workspace while you're still a member", () => {
    expect(pickCurrent(list, "a")).toBe("a");
  });

  it("falls back to the personal workspace", () => {
    expect(pickCurrent(list, "gone")).toBe("p");
    expect(pickCurrent(list, null)).toBe("p");
  });

  it("returns null with no workspaces", () => {
    expect(pickCurrent([], null)).toBeNull();
  });
});
