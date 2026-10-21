import { describe, expect, it } from "vitest";
import { FORMAT_LIST, buildPageCss, getFormat, getGeometry, layoutVariables, paperFontStack } from "./formats";

const base = { template: "ieee-conference" as const, paperSize: "letter" as const };

function toInches(length: string): number {
  const value = parseFloat(length);
  return length.endsWith("mm") ? value / 25.4 : value;
}

describe("format geometry", () => {
  it.each(FORMAT_LIST.flatMap((f) => (["letter", "a4"] as const).map((paperSize) => [f.id, paperSize] as const)))(
    "%s %s text block fits the page",
    (template, paperSize) => {
      const g = getGeometry({ template, paperSize });
      const pageWidth = paperSize === "letter" ? 8.5 : 210 / 25.4;
      const columns = g.columnCount * toInches(g.columnWidth) + (g.columnCount - 1) * toInches(g.columnGap);
      expect(columns).toBeCloseTo(toInches(g.textWidth), 2);
      expect(toInches(g.textWidth) + toInches(g.margin.left) + toInches(g.margin.right)).toBeLessThanOrEqual(pageWidth + 0.01);
    },
  );

  it("uses the IEEE Letter conference grid", () => {
    expect(layoutVariables(getGeometry(base))).toEqual({
      "--ieee-text-width": "7.25in",
      "--ieee-column-count": "2",
      "--ieee-column-width": "3.5in",
      "--ieee-column-gap": "0.25in",
    });
  });

  it("uses CompSoc conference Letter columns from IEEEtran", () => {
    expect(getGeometry({ template: "ieee-compsoc-conference", paperSize: "letter" })).toMatchObject({
      columnWidth: "3.375in",
      columnGap: "0.25in",
      textWidth: "7in",
      margin: { top: "1in", bottom: "1in", left: "0.75in", right: "0.75in" },
    });
  });

  it("uses the Access column grid from ieeeaccess.cls", () => {
    expect(layoutVariables(getGeometry({ template: "ieee-access", paperSize: "letter" }))).toEqual({
      "--ieee-text-width": "177.53mm",
      "--ieee-column-count": "2",
      "--ieee-column-width": "85.29mm",
      "--ieee-column-gap": "6.95mm",
    });
  });

  it("defaults Letters to a 4-page limit and Arabic headings only for CompSoc", () => {
    expect(getFormat({ template: "ieee-letters" }).defaultPageLimit).toBe(4);
    expect(getFormat({ template: "ieee-compsoc-journal" }).headingScheme).toBe("arabic");
    expect(getFormat({ template: "ieee-access" }).headingScheme).toBe("roman");
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
