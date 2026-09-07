import { describe, it, expect } from "vitest";
import { resolveNumbering } from "./numbering";
import type { Document, BodyNode, Reference, InlineNode } from "../types/document";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeDoc(body: BodyNode[], references: Reference[] = []): Document {
  return {
    schemaVersion: 1,
    meta: { template: "ieee-conference", paperSize: "letter", pageLimit: null },
    titleBlock: {
      title: [{ type: "text", text: "Test Paper" }],
      authors: [],
      affiliations: [],
    },
    abstract: { text: "Abstract text." },
    keywords: [],
    body,
    references,
  };
}

function section(id: string, heading: string, children: BodyNode[] = []): BodyNode {
  return { type: "section", id, heading, level: 1, children };
}

function paragraph(id: string, content: InlineNode[] = []): BodyNode {
  return { type: "paragraph", id, content };
}

function figure(id: string): BodyNode {
  return {
    type: "figure", id, width: "single-column", images: [], caption: [],
  };
}

function table(id: string): BodyNode {
  return {
    type: "table", id, width: "single-column", caption: [], rows: [["A", "B"]],
  };
}

function equation(id: string, latex = "E = mc^2"): BodyNode {
  return { type: "equation", id, latex };
}

function ref(id: string): Reference {
  return { id, fields: { title: id }, renderedText: id };
}

function citeRef(id: string, refId: string) {
  return { type: "citeRef" as const, id, refId };
}

function xref(id: string, targetType: "figure" | "table", targetId: string) {
  return { type: "xref" as const, id, targetType, targetId };
}

// ─── Figure numbering ────────────────────────────────────────────────────────

describe("figure numbering", () => {
  it("numbers figures sequentially starting at 1 (Arabic)", () => {
    const doc = makeDoc([figure("f1"), figure("f2"), figure("f3")]);
    const resolved = resolveNumbering(doc);
    const figs = resolved.body.filter((n) => n.type === "figure");
    expect(figs.map((f) => (f as { resolvedNumber: number }).resolvedNumber)).toEqual([1, 2, 3]);
  });

  it("numbers figures inside sections in document order", () => {
    const doc = makeDoc([
      section("s1", "Intro", [figure("f1"), figure("f2")]),
      figure("f3"),
    ]);
    const resolved = resolveNumbering(doc);
    const s1 = resolved.body[0] as { children: { type: string; resolvedNumber: number }[] };
    expect(s1.children[0].resolvedNumber).toBe(1);
    expect(s1.children[1].resolvedNumber).toBe(2);
    const f3 = resolved.body[1] as { resolvedNumber: number };
    expect(f3.resolvedNumber).toBe(3);
  });

  it("renumbers correctly after a figure is removed from the middle", () => {
    // Start with 3, remove middle, expect 1 and 2 only
    const doc = makeDoc([figure("f1"), figure("f3")]);
    const resolved = resolveNumbering(doc);
    expect((resolved.body[0] as { resolvedNumber: number }).resolvedNumber).toBe(1);
    expect((resolved.body[1] as { resolvedNumber: number }).resolvedNumber).toBe(2);
  });

  it("renumbers correctly after reorder (f2 before f1)", () => {
    const doc = makeDoc([figure("f2"), figure("f1")]);
    const resolved = resolveNumbering(doc);
    expect((resolved.body[0] as { resolvedNumber: number }).resolvedNumber).toBe(1); // f2 is now first
    expect((resolved.body[1] as { resolvedNumber: number }).resolvedNumber).toBe(2); // f1 is now second
  });
});

// ─── Table numbering ─────────────────────────────────────────────────────────

describe("table numbering", () => {
  it("numbers tables with Roman numerals starting at I", () => {
    const doc = makeDoc([table("t1"), table("t2"), table("t3")]);
    const resolved = resolveNumbering(doc);
    const tables = resolved.body.filter((n) => n.type === "table");
    expect(tables.map((t) => (t as { resolvedNumber: string }).resolvedNumber)).toEqual([
      "I", "II", "III",
    ]);
  });

  it("numbers 4 tables correctly: IV", () => {
    const doc = makeDoc([table("t1"), table("t2"), table("t3"), table("t4")]);
    const resolved = resolveNumbering(doc);
    expect((resolved.body[3] as { resolvedNumber: string }).resolvedNumber).toBe("IV");
  });

  it("renumbers tables after reorder", () => {
    const doc = makeDoc([table("t2"), table("t1")]);
    const resolved = resolveNumbering(doc);
    expect((resolved.body[0] as { resolvedNumber: string }).resolvedNumber).toBe("I");
    expect((resolved.body[1] as { resolvedNumber: string }).resolvedNumber).toBe("II");
  });
});

// ─── Equation numbering ──────────────────────────────────────────────────────

describe("equation numbering", () => {
  it("numbers equations with Arabic numerals starting at 1", () => {
    const doc = makeDoc([equation("e1"), equation("e2")]);
    const resolved = resolveNumbering(doc);
    expect((resolved.body[0] as { resolvedNumber: number }).resolvedNumber).toBe(1);
    expect((resolved.body[1] as { resolvedNumber: number }).resolvedNumber).toBe(2);
  });
});

// ─── Section numbering ───────────────────────────────────────────────────────

describe("section numbering", () => {
  it("numbers top-level sections with Roman numerals", () => {
    const doc = makeDoc([section("s1", "Intro"), section("s2", "Method"), section("s3", "Results")]);
    const resolved = resolveNumbering(doc);
    const sections = resolved.body as { resolvedNumber: string }[];
    expect(sections[0].resolvedNumber).toBe("I");
    expect(sections[1].resolvedNumber).toBe("II");
    expect(sections[2].resolvedNumber).toBe("III");
  });

  it("numbers subsections with capital letters (A, B, C)", () => {
    const doc = makeDoc([
      section("s1", "Method", [
        section("s1a", "SubA"),
        section("s1b", "SubB"),
        section("s1c", "SubC"),
      ]),
    ]);
    const resolved = resolveNumbering(doc);
    const s1 = resolved.body[0] as { children: { resolvedNumber: string }[] };
    expect(s1.children[0].resolvedNumber).toBe("A");
    expect(s1.children[1].resolvedNumber).toBe("B");
    expect(s1.children[2].resolvedNumber).toBe("C");
  });

  it("resets subsection numbering per parent section", () => {
    const doc = makeDoc([
      section("s1", "Intro", [section("s1a", "Sub1"), section("s1b", "Sub2")]),
      section("s2", "Method", [section("s2a", "Sub1")]),
    ]);
    const resolved = resolveNumbering(doc);
    const s2 = resolved.body[1] as { children: { resolvedNumber: string }[] };
    // Sub1 under s2 should still be "A", not "C"
    expect(s2.children[0].resolvedNumber).toBe("A");
  });

  it("numbers depth-2 subsections with Arabic numerals", () => {
    const doc = makeDoc([
      section("s1", "Top", [
        section("s1a", "Sub", [
          section("s1a1", "SubSub"),
          section("s1a2", "SubSub2"),
        ]),
      ]),
    ]);
    const resolved = resolveNumbering(doc);
    const sub = (resolved.body[0] as { children: { children: { resolvedNumber: string }[] }[] }).children[0];
    expect(sub.children[0].resolvedNumber).toBe("1");
    expect(sub.children[1].resolvedNumber).toBe("2");
  });
});

// ─── Citation ordering ───────────────────────────────────────────────────────

describe("citation ordering", () => {
  it("numbers citations by first appearance in document, not reference array order", () => {
    // ref2 is cited before ref1 in the text
    const doc = makeDoc(
      [
        paragraph("p1", [citeRef("c1", "ref2"), citeRef("c2", "ref1")]),
      ],
      [ref("ref1"), ref("ref2")]
    );
    const resolved = resolveNumbering(doc);
    const para = resolved.body[0] as { content: { type: string; resolvedNumber: number }[] };
    expect(para.content[0].resolvedNumber).toBe(1); // ref2 cited first → [1]
    expect(para.content[1].resolvedNumber).toBe(2); // ref1 cited second → [2]
    // In the resolved references list, ref2 should come before ref1
    expect(resolved.references[0].id).toBe("ref2");
    expect(resolved.references[1].id).toBe("ref1");
  });

  it("gives the same number to repeated citations of the same reference", () => {
    const doc = makeDoc(
      [paragraph("p1", [citeRef("c1", "ref1"), citeRef("c2", "ref1")])],
      [ref("ref1")]
    );
    const resolved = resolveNumbering(doc);
    const para = resolved.body[0] as { content: { type: string; resolvedNumber: number }[] };
    expect(para.content[0].resolvedNumber).toBe(1);
    expect(para.content[1].resolvedNumber).toBe(1); // same ref → same number
  });

  it("assigns numbers to uncited references after all cited ones", () => {
    const doc = makeDoc(
      [paragraph("p1", [citeRef("c1", "ref1")])],
      [ref("ref1"), ref("ref2"), ref("ref3")] // ref2 and ref3 are uncited
    );
    const resolved = resolveNumbering(doc);
    const nums = resolved.references.map((r) => r.resolvedNumber);
    expect(nums[0]).toBe(1); // ref1 → [1]
    expect(nums[1]).toBe(2); // ref2 uncited, gets next number
    expect(nums[2]).toBe(3); // ref3 uncited, gets next number
  });

  it("renumbers citations correctly after paragraph reorder", () => {
    // p2 (citing ref2) before p1 (citing ref1)
    const doc = makeDoc(
      [
        paragraph("p2", [citeRef("c2", "ref2")]),
        paragraph("p1", [citeRef("c1", "ref1")]),
      ],
      [ref("ref1"), ref("ref2")]
    );
    const resolved = resolveNumbering(doc);
    const p2 = resolved.body[0] as { content: { resolvedNumber: number }[] };
    const p1 = resolved.body[1] as { content: { resolvedNumber: number }[] };
    expect(p2.content[0].resolvedNumber).toBe(1); // ref2 is now first
    expect(p1.content[0].resolvedNumber).toBe(2); // ref1 is now second
  });
});

// ─── Cross-references (xref) ─────────────────────────────────────────────────

describe("xref resolution", () => {
  it("resolves a figure xref to the correct figure number", () => {
    const doc = makeDoc([
      paragraph("p1", [xref("x1", "figure", "f1")]),
      figure("f1"),
      figure("f2"),
    ]);
    const resolved = resolveNumbering(doc);
    const para = resolved.body[0] as { content: { resolvedNumber: number | string }[] };
    expect(para.content[0].resolvedNumber).toBe(1); // f1 is figure 1
  });

  it("resolves a table xref to the correct Roman numeral", () => {
    const doc = makeDoc([
      paragraph("p1", [xref("x1", "table", "t2")]),
      table("t1"),
      table("t2"),
    ]);
    const resolved = resolveNumbering(doc);
    const para = resolved.body[0] as { content: { resolvedNumber: number | string }[] };
    expect(para.content[0].resolvedNumber).toBe("II"); // t2 is table II
  });

  it("resolves xref 0 for a reference to a non-existent target", () => {
    const doc = makeDoc([
      paragraph("p1", [xref("x1", "figure", "ghost")]),
    ]);
    const resolved = resolveNumbering(doc);
    const para = resolved.body[0] as { content: { resolvedNumber: number | string }[] };
    expect(para.content[0].resolvedNumber).toBe(0); // fallback for missing target
  });

  it("correctly resolves a forward xref (figure comes after the paragraph citing it)", () => {
    // The xref appears BEFORE the figure in document order — should still resolve
    const doc = makeDoc([
      paragraph("p1", [xref("x1", "figure", "f1")]),
      figure("f1"),
    ]);
    const resolved = resolveNumbering(doc);
    const para = resolved.body[0] as { content: { resolvedNumber: number | string }[] };
    expect(para.content[0].resolvedNumber).toBe(1);
  });
});

// ─── Mixed document ───────────────────────────────────────────────────────────

describe("mixed document", () => {
  it("numbers all block types independently in a realistic paper layout", () => {
    const doc = makeDoc([
      section("s1", "Intro"),
      paragraph("p1", [citeRef("c1", "r1")]),
      figure("f1"),
      section("s2", "Method"),
      table("t1"),
      figure("f2"),
      equation("e1"),
      section("s3", "Results"),
      table("t2"),
    ], [ref("r1")]);

    const resolved = resolveNumbering(doc);

    // Sections: I, II, III
    expect((resolved.body[0] as { resolvedNumber: string }).resolvedNumber).toBe("I");
    expect((resolved.body[3] as { resolvedNumber: string }).resolvedNumber).toBe("II");
    expect((resolved.body[7] as { resolvedNumber: string }).resolvedNumber).toBe("III");

    // Figures: 1, 2
    expect((resolved.body[2] as { resolvedNumber: number }).resolvedNumber).toBe(1);
    expect((resolved.body[5] as { resolvedNumber: number }).resolvedNumber).toBe(2);

    // Tables: I, II
    expect((resolved.body[4] as { resolvedNumber: string }).resolvedNumber).toBe("I");
    expect((resolved.body[8] as { resolvedNumber: string }).resolvedNumber).toBe("II");

    // Equation: 1
    expect((resolved.body[6] as { resolvedNumber: number }).resolvedNumber).toBe(1);
  });
});
