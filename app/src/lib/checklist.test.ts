import { describe, it, expect } from "vitest";
import { runChecklist, checklistSummary, countWords } from "./checklist";
import type { BodyNode, Document, InlineNode, Reference } from "../types/document";

function makeDoc(overrides: Partial<Document> = {}): Document {
  return {
    schemaVersion: 1,
    meta: { template: "ieee-conference", paperSize: "letter", pageLimit: 6 },
    titleBlock: {
      title: [{ type: "text", text: "A Paper" }],
      authors: [{ id: "a1", name: "Ada Lovelace", affiliationRefs: [] }],
      affiliations: [],
    },
    abstract: { text: "This paper studies things." },
    keywords: ["things"],
    body: [],
    references: [],
    ...overrides,
  };
}

const text = (t: string): InlineNode => ({ type: "text", text: t });
const cite = (refId: string): InlineNode => ({ type: "citeRef", id: `c-${refId}`, refId });
const xref = (targetId: string, targetType: "figure" | "table" = "figure"): InlineNode => ({
  type: "xref",
  id: `x-${targetId}`,
  targetType,
  targetId,
});
const para = (id: string, content: InlineNode[]): BodyNode => ({ type: "paragraph", id, content });
const fig = (id: string, caption: InlineNode[] = [text("A figure")]): BodyNode => ({
  type: "figure",
  id,
  width: "single-column",
  images: [],
  caption,
});
const ref = (id: string, title = id): Reference => ({ id, fields: { title }, renderedText: title });

function item(doc: Document, id: string, pageCount: number | null = 4) {
  const found = runChecklist(doc, pageCount).find((i) => i.id === id);
  if (!found) throw new Error(`no checklist item ${id}`);
  return found;
}

describe("countWords", () => {
  it("counts whitespace-separated words and treats blank as zero", () => {
    expect(countWords("  ")).toBe(0);
    expect(countWords("one two\nthree")).toBe(3);
  });
});

describe("runChecklist", () => {
  it("passes everything for a complete paper within its limit", () => {
    const doc = makeDoc({
      body: [para("p1", [text("See "), xref("f1"), text(" and "), cite("r1")]), fig("f1")],
      references: [ref("r1")],
    });
    expect(checklistSummary(runChecklist(doc, 5))).toEqual({ fail: 0, warn: 0, pass: 9 });
  });

  it("fails a missing title and unnamed authors", () => {
    const doc = makeDoc({
      titleBlock: { title: [text("  ")], authors: [{ id: "a", name: "", affiliationRefs: [] }], affiliations: [] },
    });
    expect(item(doc, "title").status).toBe("fail");
    expect(item(doc, "authors").status).toBe("fail");
  });

  it("warns when the abstract runs over 150 words and fails when empty", () => {
    expect(item(makeDoc({ abstract: { text: "word ".repeat(151) } }), "abstract").status).toBe("warn");
    expect(item(makeDoc({ abstract: { text: "" } }), "abstract").status).toBe("fail");
  });

  it("fails a non-Times font", () => {
    const doc = makeDoc();
    doc.meta.fontFamily = "arial";
    expect(item(doc, "font").status).toBe("fail");
  });

  it("checks the page count against the venue limit", () => {
    expect(item(makeDoc(), "page-limit", 7).status).toBe("fail");
    expect(item(makeDoc(), "page-limit", 6).status).toBe("pass");
    expect(item(makeDoc(), "page-limit", null).status).toBe("warn");
    const noLimit = makeDoc();
    noLimit.meta.pageLimit = null;
    expect(item(noLimit, "page-limit").status).toBe("warn");
  });

  it("names uncited references", () => {
    const doc = makeDoc({
      body: [para("p1", [cite("r1")])],
      references: [ref("r1"), ref("r2", "Deep Learning")],
    });
    const result = item(doc, "references-cited");
    expect(result.status).toBe("fail");
    expect(result.detail).toContain("Deep Learning");
  });

  it("finds citations inside nested sections and captions", () => {
    const doc = makeDoc({
      body: [{ type: "section", id: "s1", heading: "Intro", level: 1, children: [fig("f1", [text("From "), cite("r1")])] }],
      references: [ref("r1")],
    });
    expect(item(doc, "references-cited").status).toBe("pass");
  });

  it("points to the first figure that is never cross-referenced", () => {
    const doc = makeDoc({ body: [para("p1", [xref("f1")]), fig("f1"), fig("f2")] });
    const result = item(doc, "floats-referenced");
    expect(result.status).toBe("warn");
    expect(result.target).toEqual({ kind: "block", id: "f2" });
  });

  it("fails empty captions", () => {
    const doc = makeDoc({ body: [para("p1", [xref("f1")]), fig("f1", [text(" ")])] });
    expect(item(doc, "captions").status).toBe("fail");
  });
});
