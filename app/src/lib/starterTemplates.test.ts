import { describe, it, expect } from "vitest";
import { DocumentSchema, type BodyNode } from "../types/document";
import { createBlankDocument } from "./blankDocument";
import { STARTER_TEMPLATES } from "./starterTemplates";

function ids(nodes: BodyNode[]): string[] {
  return nodes.flatMap((n) => [n.id, ...(n.type === "section" ? ids(n.children) : [])]);
}

describe("starter templates", () => {
  it.each(STARTER_TEMPLATES.map((t) => t.id))("%s builds a valid document with unique ids", (id) => {
    const doc = createBlankDocument(id);
    expect(() => DocumentSchema.parse(doc)).not.toThrow();
    const all = ids(doc.body);
    expect(new Set(all).size).toBe(all.length);
  });

  it("nests subsections one level deeper than their parent", () => {
    const doc = createBlankDocument("experimental");
    const setup = doc.body.find((n) => n.type === "section" && n.heading === "Experimental Setup");
    expect(setup?.type).toBe("section");
    if (setup?.type !== "section") return;
    const sub = setup.children.filter((c) => c.type === "section");
    expect(sub.map((s) => (s.type === "section" ? [s.heading, s.level] : null))).toEqual([
      ["Datasets", 2],
      ["Evaluation Metrics", 2],
    ]);
  });

  it("defaults to the standard research paper structure", () => {
    const headings = createBlankDocument().body.map((n) => (n.type === "section" ? n.heading : ""));
    expect(headings).toEqual(["Introduction", "Methodology", "Results", "Conclusion"]);
  });
});
