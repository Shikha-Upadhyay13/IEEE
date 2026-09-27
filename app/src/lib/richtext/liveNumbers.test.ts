import { describe, it, expect } from "vitest";
import { citationNumberFor, xrefLabelFor } from "./liveNumbers";
import type { Document, BodyNode, Reference } from "../../types/document";

function makeDoc(body: BodyNode[], references: Reference[] = []): Document {
  return {
    schemaVersion: 1,
    meta: { template: "ieee-conference", paperSize: "letter", pageLimit: null },
    titleBlock: { title: [{ type: "text", text: "T" }], authors: [], affiliations: [] },
    abstract: { text: "" },
    keywords: [],
    body,
    references,
  };
}

const ref = (id: string): Reference => ({ id, fields: {}, renderedText: id });

describe("citationNumberFor", () => {
  it("matches first-appearance order, with uncited refs numbered after", () => {
    const doc = makeDoc(
      [{ type: "paragraph", id: "p1", content: [{ type: "citeRef", id: "c1", refId: "b" }] }],
      [ref("a"), ref("b")]
    );
    expect(citationNumberFor(doc, "b")).toBe(1);
    expect(citationNumberFor(doc, "a")).toBe(2);
  });

  it("returns null for a deleted reference", () => {
    expect(citationNumberFor(makeDoc([]), "gone")).toBeNull();
  });
});

describe("xrefLabelFor", () => {
  it("labels figures in Arabic and tables in Roman numerals, including nested ones", () => {
    const doc = makeDoc([
      { type: "figure", id: "f1", width: "single-column", images: [], caption: [] },
      {
        type: "section",
        id: "s1",
        heading: "S",
        level: 1,
        children: [
          { type: "table", id: "t1", width: "single-column", caption: [], rows: [["x"]] },
          { type: "table", id: "t2", width: "single-column", caption: [], rows: [["x"]] },
          { type: "figure", id: "f2", width: "single-column", images: [], caption: [] },
        ],
      },
    ]);
    expect(xrefLabelFor(doc, "figure", "f2")).toBe("Fig. 2");
    expect(xrefLabelFor(doc, "table", "t2")).toBe("Table II");
  });

  it("returns null for a deleted target", () => {
    expect(xrefLabelFor(makeDoc([]), "figure", "gone")).toBeNull();
  });
});
