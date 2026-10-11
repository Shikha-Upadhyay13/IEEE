import { describe as group, expect, it, vi } from "vitest";

vi.mock("../supabaseClient", () => ({ supabase: {} }));

import { describe, destination, type Notification } from "./notifications";

const n = (overrides: Partial<Notification>): Notification => ({
  id: "n",
  kind: "comment",
  documentId: "d1",
  workspaceId: null,
  actorId: "a",
  payload: { title: "Vision" },
  readAt: null,
  createdAt: "2026-01-01T00:00:00Z",
  ...overrides,
});

group("describe", () => {
  it("phrases each kind of notification", () => {
    expect(describe(n({ kind: "paper_shared", payload: { title: "Vision", role: "reviewer" } }))).toBe("shared “Vision” with you as reviewer");
    expect(describe(n({ kind: "mention" }))).toBe("mentioned you in “Vision”");
    expect(describe(n({ kind: "suggestion_decided", payload: { title: "Vision", status: "accepted" } }))).toBe(
      "accepted your suggestion on “Vision”",
    );
    expect(describe(n({ kind: "workspace_added", documentId: null, payload: { workspace: "Lab" } }))).toBe(
      "added you to the Lab workspace",
    );
    expect(describe(n({ kind: "workspace_added", documentId: null, payload: {} }))).toBe("added you to a workspace");
  });
});

group("destination", () => {
  it("opens the paper, or the dashboard for workspace news", () => {
    expect(destination(n({}))).toBe("/editor/d1");
    expect(destination(n({ kind: "workspace_added", documentId: null }))).toBe("/dashboard");
  });
});
