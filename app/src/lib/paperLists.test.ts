import { describe, expect, it, vi } from "vitest";

vi.mock("../supabaseClient", () => ({ supabase: {} }));

import { parsePaperView } from "./paperLists";

describe("parsePaperView", () => {
  it("accepts known views", () => {
    expect(parsePaperView("shared")).toBe("shared");
    expect(parsePaperView("trash")).toBe("trash");
  });

  it("falls back to my papers for missing or unknown values", () => {
    expect(parsePaperView(null)).toBe("mine");
    expect(parsePaperView("everything")).toBe("mine");
  });
});
