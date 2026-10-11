import { describe, expect, it } from "vitest";
import { cssLengthToInches, findLowResolutionFigures, printedWidthInches } from "./figureResolution";
import type { BodyNode } from "../types/document";

type Figure = Extract<BodyNode, { type: "figure" }>;
const meta = { template: "ieee-conference", paperSize: "letter" } as const;
const figure = (overrides: Partial<Figure> = {}): Figure => ({
  type: "figure",
  id: "f1",
  width: "single-column",
  images: [{ url: "a.png", alt: "" }],
  caption: [],
  ...overrides,
});

describe("figure resolution", () => {
  it("converts CSS lengths to inches", () => {
    expect(cssLengthToInches("3.5in")).toBe(3.5);
    expect(cssLengthToInches("25.4mm")).toBeCloseTo(1);
  });

  it("divides the column between subfigures and applies scale", () => {
    expect(printedWidthInches(figure(), meta)).toBe(3.5);
    expect(printedWidthInches(figure({ width: "double-column" }), meta)).toBe(7.25);
    expect(printedWidthInches(figure({ scale: 50, images: [{ url: "a", alt: "" }, { url: "b", alt: "" }] }), meta)).toBe(
      0.875
    );
  });

  it("flags images under 300 dpi at printed size and skips unknown sizes", () => {
    const widths = new Map([["a.png", 700]]);
    expect(findLowResolutionFigures([figure()], meta, widths)).toEqual([{ id: "f1", dpi: 200 }]);
    expect(findLowResolutionFigures([figure()], meta, new Map([["a.png", 1050]]))).toEqual([]);
    expect(findLowResolutionFigures([figure()], meta, new Map())).toEqual([]);
  });
});
