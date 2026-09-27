import { describe, it, expect } from "vitest";
import { buildReviewContext, findSectionForNote, parseReview } from "./review";
import { createBlankDocument } from "./blankDocument";

describe("parseReview", () => {
  it("reads JSON wrapped in a code fence", () => {
    const raw = '```json\n{"summary":"Clear overall.","notes":[{"section":"Introduction","kind":"clarity","comment":"Define IoT."}]}\n```';
    expect(parseReview(raw)).toEqual({
      summary: "Clear overall.",
      notes: [{ section: "Introduction", kind: "clarity", comment: "Define IoT." }],
    });
  });

  it("coerces unknown kinds and drops empty comments", () => {
    const review = parseReview('{"notes":[{"section":"Results","kind":"accuracy","comment":"Split this."},{"comment":" "}]}');
    expect(review?.notes).toEqual([{ section: "Results", kind: "clarity", comment: "Split this." }]);
  });

  it("returns null for non-JSON output", () => {
    expect(parseReview("Sorry, I can't help with that.")).toBeNull();
  });
});

describe("review context and section matching", () => {
  const doc = createBlankDocument("experimental");

  it("includes numbered headings and the abstract", () => {
    const text = buildReviewContext(doc);
    expect(text).toContain("Abstract: (empty)");
    expect(text).toContain("I. Introduction");
    expect(text).toContain("A. Datasets");
  });

  it("matches a note to a section by heading, ignoring numbering and case", () => {
    const setup = doc.body.find((n) => n.type === "section" && n.heading === "Experimental Setup");
    expect(findSectionForNote(doc.body, "IV. EXPERIMENTAL SETUP")).toBe(setup?.id);
    expect(findSectionForNote(doc.body, "Abstract")).toBeNull();
  });
});
