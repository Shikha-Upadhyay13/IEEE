import { describe, expect, it } from "vitest";
import {
  countAuthors,
  findDuplicateReferences,
  fixPageRangeDashes,
  hasHyphenPageRange,
  isUnverified,
} from "./referenceChecks";
import type { Reference } from "../types/document";

const ref = (id: string, fields: Record<string, string>, renderedText = fields.title ?? id): Reference => ({
  id,
  fields,
  renderedText,
});

describe("page ranges", () => {
  it("swaps hyphens for en dashes only in page ranges", () => {
    expect(fixPageRangeDashes("IEEE Trans., vol. 3, pp. 549-557, 1988.")).toBe("IEEE Trans., vol. 3, pp. 549–557, 1988.");
    expect(fixPageRangeDashes("IEEE Std. 1036-2010, p. 81.")).toBe("IEEE Std. 1036-2010, p. 81.");
    expect(hasHyphenPageRange("pp. 549–557")).toBe(false);
    expect(hasHyphenPageRange("pp. 1012--1028")).toBe(true);
  });
});

describe("findDuplicateReferences", () => {
  it("matches the same DOI regardless of prefix and case", () => {
    const refs = [ref("a", { title: "One", doi: "https://doi.org/10.1109/ABC" }), ref("b", { title: "Two", doi: "10.1109/abc" })];
    expect(findDuplicateReferences(refs)).toEqual([[0, 1]]);
  });

  it("matches near-identical titles but not different papers", () => {
    const refs = [
      ref("a", { title: "Deep residual learning for image recognition" }),
      ref("b", { title: "Deep Residual Learning for Image Recognition." }),
      ref("c", { title: "Attention is all you need" }),
    ];
    expect(findDuplicateReferences(refs)).toEqual([[0, 1]]);
  });
});

describe("authors and verification", () => {
  it("counts authors in IEEE and semicolon lists", () => {
    expect(countAuthors("J. F. Fuller, E. F. Fuchs, and K. J. Roesler")).toBe(3);
    expect(countAuthors("A; B; C; D; E; F; G")).toBe(7);
    expect(countAuthors("A. One et al.")).toBe(0);
  });

  it("flags structured references never matched against Crossref", () => {
    expect(isUnverified(ref("a", { title: "T" }))).toBe(true);
    expect(isUnverified(ref("a", { title: "T", verifiedAt: "2026-01-01" }))).toBe(false);
    expect(isUnverified(ref("a", { authors: "X" }, "Free text"))).toBe(false);
  });
});
