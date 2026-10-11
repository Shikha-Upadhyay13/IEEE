import { describe, expect, it } from "vitest";
import { findAuthorMentions, isAcknowledgmentHeading, withoutAcknowledgments } from "./blind";
import type { BodyNode } from "../../types/document";

const section = (id: string, heading: string): BodyNode => ({ type: "section", id, heading, level: 1, children: [] });

describe("double-blind helpers", () => {
  it("recognises acknowledgment headings in US and UK spelling", () => {
    expect(isAcknowledgmentHeading("Acknowledgment")).toBe(true);
    expect(isAcknowledgmentHeading("ACKNOWLEDGEMENTS")).toBe(true);
    expect(isAcknowledgmentHeading("Related work")).toBe(false);
  });

  it("drops acknowledgment sections only", () => {
    const body = [section("s1", "Introduction"), section("s2", "Acknowledgments")];
    expect(withoutAcknowledgments(body).map((n) => n.id)).toEqual(["s1"]);
  });

  it("finds author surnames in the text", () => {
    const authors = [
      { id: "a1", name: "Ada Lovelace", affiliationRefs: [] },
      { id: "a2", name: "Alan Turing", affiliationRefs: [] },
    ];
    const blocks = [
      { id: "p1", text: "As shown in our earlier paper by Lovelace et al. [2]." },
      { id: "p2", text: "Turing machines are unrelated here." },
    ];
    expect(findAuthorMentions(authors, blocks)).toEqual([
      { name: "Ada Lovelace", blockId: "p1" },
      { name: "Alan Turing", blockId: "p2" },
    ]);
    expect(findAuthorMentions(authors, [{ id: "p1", text: "Nothing here." }])).toEqual([]);
  });
});
