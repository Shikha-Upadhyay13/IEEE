import { describe, expect, it } from "vitest";
import { affiliationFootnote, authorLine, journalHeader } from "./journal";
import { buildPageCss } from "./formats";
import type { Document } from "../../types/document";

const titleBlock: Document["titleBlock"] = {
  title: [],
  authors: [
    { id: "a1", name: "Ada Lovelace", affiliationRefs: ["x"], email: "ada@uni.edu" },
    { id: "a2", name: "Alan Turing", affiliationRefs: ["x"] },
    { id: "a3", name: "Grace Hopper", affiliationRefs: [], email: "grace@navy.mil" },
  ],
  affiliations: [{ id: "x", text: "the Department of Computing, Example University, London, U.K." }],
};

describe("journal front matter", () => {
  it("builds the running head and skips blank parts", () => {
    expect(journalHeader({ name: "IEEE Transactions on Robotics", volume: "12", number: "", date: "March 2026", received: "" })).toBe(
      "IEEE TRANSACTIONS ON ROBOTICS, VOL. 12, MARCH 2026"
    );
    expect(journalHeader(null)).toBe("IEEE TRANSACTIONS");
  });

  it("joins author names the IEEE way", () => {
    expect(authorLine(titleBlock)).toBe("Ada Lovelace, Alan Turing, and Grace Hopper");
  });

  it("writes the first-page affiliation footnote", () => {
    expect(affiliationFootnote(titleBlock, "1 January 2026; revised 2 February 2026.")).toEqual([
      "Manuscript received 1 January 2026; revised 2 February 2026.",
      "Ada Lovelace and Alan Turing are with the Department of Computing, Example University, London, U.K. (e-mail: ada@uni.edu).",
      "Grace Hopper (e-mail: grace@navy.mil).",
    ]);
  });

  it("puts the running head and page number in the top margin", () => {
    const css = buildPageCss({ template: "ieee-journal", paperSize: "letter", showPageNumbers: false });
    expect(css).toContain('@top-left { content: "IEEE TRANSACTIONS"');
    expect(css).toContain("@top-right { content: counter(page)");
    expect(css).not.toContain("@bottom-center");
  });

  it("gives technical notes the same running head", () => {
    const css = buildPageCss({ template: "ieee-technote", paperSize: "a4", showPageNumbers: true });
    expect(css).toContain("@top-left");
    expect(css).not.toContain("@bottom-center");
  });
});
