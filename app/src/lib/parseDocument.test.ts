import { describe, expect, it } from "vitest";
import { parseDocument } from "./parseDocument";
import { createBlankDocument } from "./blankDocument";
import { samplePaper } from "../data/samplePaper";

describe("parseDocument", () => {
  it("accepts a valid paper unchanged", () => {
    const result = parseDocument(samplePaper);
    expect(result.ok && result.repaired).toBe(false);
  });

  it("accepts a new blank paper", () => {
    expect(parseDocument(createBlankDocument()).ok).toBe(true);
  });

  it("fills in missing top-level fields without touching content", () => {
    const result = parseDocument({
      meta: { template: "ieee-conference", paperSize: "a4" },
      body: [{ type: "paragraph", id: "p1", content: [{ type: "text", text: "Kept" }] }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.repaired).toBe(true);
    expect(result.document.meta.pageLimit).toBeNull();
    expect(result.document.meta.paperSize).toBe("a4");
    expect(result.document.references).toEqual([]);
    expect(result.document.body[0]).toEqual({ type: "paragraph", id: "p1", content: [{ type: "text", text: "Kept" }] });
  });

  it("reports where the data is invalid", () => {
    const result = parseDocument({ body: [{ type: "paragraph", id: "p1", content: "not an array" }] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("body.0");
  });

  it("rejects non-objects", () => {
    expect(parseDocument(null).ok).toBe(false);
    expect(parseDocument("text").ok).toBe(false);
  });
});
