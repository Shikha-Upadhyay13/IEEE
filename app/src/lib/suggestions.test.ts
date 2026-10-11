import { describe, expect, it, vi } from "vitest";

vi.mock("../supabaseClient", () => ({ supabase: {} }));

import { diffWords, isStale, paragraphs, readable } from "./suggestions";
import type { BodyNode, InlineNode } from "../types/document";

describe("diffWords", () => {
  it("marks removed and added words, keeping shared ones", () => {
    expect(diffWords("the quick brown fox", "the slow brown fox jumps")).toEqual([
      { kind: "same", text: "the " },
      { kind: "removed", text: "quick" },
      { kind: "added", text: "slow" },
      { kind: "same", text: " brown fox" },
      { kind: "added", text: " jumps" },
    ]);
  });

  it("handles identical and empty text", () => {
    expect(diffWords("same text", "same text")).toEqual([{ kind: "same", text: "same text" }]);
    expect(diffWords("", "new")).toEqual([{ kind: "added", text: "new" }]);
  });
});

describe("isStale", () => {
  const content: InlineNode[] = [
    { type: "text", text: "As shown in " },
    { type: "citeRef", id: "c1", refId: "r1" },
    { type: "text", text: "." },
  ];

  it("is fresh while the paragraph still reads the same", () => {
    expect(isStale({ baseText: "As shown in ⟦C1⟧." }, content)).toBe(false);
  });

  it("is stale once the paragraph changed or is gone", () => {
    expect(isStale({ baseText: "Older text ⟦C1⟧." }, content)).toBe(true);
    expect(isStale({ baseText: "As shown in ⟦C1⟧." }, undefined)).toBe(true);
  });
});

describe("paragraphs and readable", () => {
  it("lists nested paragraphs and shows markers readably", () => {
    const body: BodyNode[] = [
      { type: "section", id: "s", heading: "A", level: 1, children: [{ type: "paragraph", id: "p", content: [] }] },
    ];
    expect(paragraphs(body).map((p) => p.id)).toEqual(["p"]);
    expect(readable("See ⟦C1⟧ and ⟦X2⟧.")).toBe("See [cite] and [ref].");
  });
});
