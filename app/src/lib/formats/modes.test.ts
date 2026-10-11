import { describe, expect, it } from "vitest";
import { effectiveMeta, getMode, inferMode, isAllowed } from "./modes";
import { buildPageCss, getGeometry } from "./formats";
import type { Document } from "../../types/document";

const meta = (extra: Partial<Document["meta"]> = {}): Document["meta"] => ({
  template: "ieee-conference",
  paperSize: "letter",
  pageLimit: null,
  ...extra,
});

describe("inferMode", () => {
  it("keeps untouched papers in Submission mode", () => {
    expect(inferMode(meta())).toBe("submission");
    expect(inferMode(meta({ fontFamily: "times", spacingDensity: "standard" }))).toBe("submission");
  });

  it("puts papers using review aids in Draft mode", () => {
    expect(inferMode(meta({ showPageNumbers: true }))).toBe("draft");
    expect(inferMode(meta({ linkStyle: { underline: true, colored: false } }))).toBe("draft");
    expect(inferMode(meta({ spacingDensity: "relaxed" }))).toBe("draft");
  });

  it("puts papers with a non-Times font in Custom mode", () => {
    expect(inferMode(meta({ fontFamily: "arial", showPageNumbers: true }))).toBe("custom");
  });

  it("prefers an explicit mode", () => {
    expect(getMode(meta({ mode: "submission", fontFamily: "arial" }))).toBe("submission");
  });
});

describe("effectiveMeta", () => {
  it("renders legacy papers exactly as before", () => {
    const legacy = meta({ fontFamily: "georgia", showPageNumbers: true, spacingDensity: "compact" });
    const effective = effectiveMeta(legacy);
    expect(effective.fontFamily).toBe("georgia");
    expect(effective.showPageNumbers).toBe(true);
    expect(effective.spacingDensity).toBe("compact");
  });

  it("ignores disallowed choices in Submission mode without deleting them", () => {
    const stored = meta({
      mode: "submission",
      fontFamily: "arial",
      showPageNumbers: true,
      linkStyle: { underline: true, colored: true },
      spacingDensity: "relaxed",
      draftWatermark: true,
    });
    const effective = effectiveMeta(stored);
    expect(effective).toMatchObject({
      fontFamily: "times",
      showPageNumbers: false,
      linkStyle: undefined,
      spacingDensity: "standard",
      draftWatermark: false,
    });
    expect(stored.fontFamily).toBe("arial");
  });

  it("allows page numbers and the DRAFT mark in Draft mode but not fonts", () => {
    const effective = effectiveMeta(meta({ mode: "draft", fontFamily: "arial", showPageNumbers: true, draftWatermark: true }));
    expect(effective.fontFamily).toBe("times");
    expect(effective.showPageNumbers).toBe(true);
    expect(buildPageCss(effective)).toContain("DRAFT");
  });

  it("documents which properties each mode allows", () => {
    expect(isAllowed("fontFamily", "custom")).toBe(true);
    expect(isAllowed("draftWatermark", "custom")).toBe(false);
  });
});

describe("peer-review format", () => {
  it("is a single 6.5in column with 1in margins", () => {
    const g = getGeometry(meta({ template: "ieee-peer-review" }));
    expect(g.columnCount).toBe(1);
    expect(g.textWidth).toBe("6.5in");
    expect(g.margin.left).toBe("1in");
  });
});
