import type { BodyNode, Document } from "../types/document";
import { getGeometry } from "./formats/formats";

/** IEEE asks for 300 dpi for photos and 600 dpi for line art at printed size. */
export const MIN_PHOTO_DPI = 300;

/** "3.5in" or "88mm" → inches. */
export function cssLengthToInches(length: string): number {
  const value = parseFloat(length);
  if (length.endsWith("mm")) return value / 25.4;
  if (length.endsWith("cm")) return value / 2.54;
  return value;
}

type Figure = Extract<BodyNode, { type: "figure" }>;

export function figureImages(figure: Figure) {
  return figure.images.length > 0 ? figure.images : figure.image ? [figure.image] : [];
}

/** Printed width of one image in a figure; subfigures share the width side by side. */
export function printedWidthInches(figure: Figure, meta: Pick<Document["meta"], "template" | "paperSize">): number {
  const g = getGeometry(meta);
  const full = cssLengthToInches(figure.width === "double-column" ? g.textWidth : g.columnWidth);
  const count = Math.max(1, figureImages(figure).length);
  return (full * (figure.scale ?? 100)) / 100 / count;
}

export type LowResolutionFigure = { id: string; dpi: number };

/** Figures with an image below MIN_PHOTO_DPI. Images whose size isn't known yet are skipped. */
export function findLowResolutionFigures(
  figures: Figure[],
  meta: Pick<Document["meta"], "template" | "paperSize">,
  imageWidths: ReadonlyMap<string, number>
): LowResolutionFigure[] {
  const low: LowResolutionFigure[] = [];
  for (const figure of figures) {
    const inches = printedWidthInches(figure, meta);
    const dpis = figureImages(figure).flatMap((img) => {
      const px = imageWidths.get(img.url);
      return px ? [Math.round(px / inches)] : [];
    });
    const worst = Math.min(...dpis);
    if (dpis.length > 0 && worst < MIN_PHOTO_DPI) low.push({ id: figure.id, dpi: worst });
  }
  return low;
}
