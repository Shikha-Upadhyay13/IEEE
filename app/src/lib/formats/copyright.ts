import type { Document } from "../../types/document";

export type CopyrightNotice = NonNullable<Document["meta"]["copyrightNotice"]>;
export type CopyrightVariant = CopyrightNotice["variant"];

export const COPYRIGHT_VARIANTS: { id: CopyrightVariant; label: string }[] = [
  { id: "ieee", label: "IEEE (most authors)" },
  { id: "us-gov", label: "U.S. Government employees" },
  { id: "crown", label: "Crown copyright (UK, Canada, Australia governments)" },
  { id: "eu", label: "European Union employees" },
  { id: "custom", label: "Custom text from the conference" },
];

/**
 * The first-page notice IEEE asks camera-ready conference papers to carry,
 * e.g. "979-8-3503-1234-5/24/$31.00 ©2024 IEEE". The code (ISBN-based
 * identifier) and price come from the conference's copyright form.
 */
export function copyrightText(notice: CopyrightNotice): string {
  const year = notice.year.trim();
  const yy = year.slice(-2);
  const prefix = `${notice.code.trim()}/${yy}/$${notice.price.trim()}`;
  switch (notice.variant) {
    case "ieee":
      return `${prefix} ©${year} IEEE`;
    case "crown":
      return `${prefix} ©${year} Crown`;
    case "eu":
      return `${prefix} ©${year} European Union`;
    case "us-gov":
      return "U.S. Government work not protected by U.S. copyright";
    case "custom":
      return notice.text?.trim() ?? "";
  }
}

export function defaultCopyrightNotice(now = new Date()): CopyrightNotice {
  return { variant: "ieee", code: "979-8-XXXX-XXXX-X", year: String(now.getFullYear()), price: "31.00" };
}

/** CSS string literal for a Paged.js margin box `content`. */
export function cssString(text: string): string {
  return `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n]+/g, " ")}"`;
}
