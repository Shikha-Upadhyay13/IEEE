import { describe, expect, it, vi } from "vitest";

vi.mock("../supabaseClient", () => ({ supabase: {} }));

import { othersFromPresence } from "./usePaperPresence";

describe("othersFromPresence", () => {
  it("leaves me out and collapses someone's tabs into one entry", () => {
    const state = {
      me: [{ email: "me@uni.edu", since: "2026-01-01T10:00:00Z" }],
      ada: [
        { email: "ada@uni.edu", since: "2026-01-01T10:05:00Z" },
        { email: "ada@uni.edu", since: "2026-01-01T10:01:00Z" },
      ],
      bob: [{ email: "bob@uni.edu", since: "2026-01-01T09:00:00Z" }],
    };
    expect(othersFromPresence(state, "me")).toEqual([
      { userId: "bob", email: "bob@uni.edu", since: "2026-01-01T09:00:00Z" },
      { userId: "ada", email: "ada@uni.edu", since: "2026-01-01T10:01:00Z" },
    ]);
  });

  it("names someone without an email generically", () => {
    expect(othersFromPresence({ x: [{}] }, "me")).toEqual([{ userId: "x", email: "A co-author", since: "" }]);
  });
});
