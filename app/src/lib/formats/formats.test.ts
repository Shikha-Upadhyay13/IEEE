import { describe, expect, it } from "vitest";
import { buildPageCss, getGeometry, layoutVariables, paperFontStack } from "./formats";

const base = { template: "ieee-conference" as const, paperSize: "letter" as const };

function toInches(length: string): number {
  const value = parseFloat(length);
  return length.endsWith("mm") ? value / 25.4 : value;
}

describe("format geometry", () => {
  it.each(["letter", "a4"] as const)("%s text block fits the page exactly", (paperSize) => {
    const g = getGeometry({ ...base, paperSize });
    const pageWidth = paperSize === "letter" ? 8.5 : 210 / 25.4;
    const columns = g.columnCount * toInches(g.columnWidth) + (g.columnCount - 1) * toInches(g.columnGap);
    expect(columns).toBeCloseTo(toInches(g.textWidth), 2);
    expect(toInches(g.textWidth) + toInches(g.margin.left) + toInches(g.margin.right)).toBeLessThanOrEqual(pageWidth + 0.01);
  });

  it("uses the IEEE Letter conference grid", () => {
    expect(layoutVariables(getGeometry(base))).toEqual({
      "--ieee-text-width": "7.25in",
      "--ieee-column-count": "2",
      "--ieee-column-width": "3.5in",
      "--ieee-column-gap": "0.25in",
    });
  });
});

describe("buildPageCss", () => {
  it("emits size and margins for A4", () => {
    const css = buildPageCss({ ...base, paperSize: "a4" });
    expect(css).toContain("size: A4;");
    expect(css).toContain("margin-top: 19mm;");
    expect(css).not.toContain("counter(page)");
  });

  it("adds page numbers in the paper's font only when asked", () => {
    const css = buildPageCss({ ...base, showPageNumbers: true, fontFamily: "arial" });
    expect(css).toContain("@bottom-center { content: counter(page); font-family: Arial");
  });

  it("defaults the paper font to Times", () => {
    expect(paperFontStack({})).toContain("Times New Roman");
  });
});
