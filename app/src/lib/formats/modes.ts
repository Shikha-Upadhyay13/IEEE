import type { Document } from "../../types/document";

export type StyleMode = "submission" | "draft" | "custom";
type Meta = Document["meta"];

export const MODES: { id: StyleMode; label: string; summary: string }[] = [
  {
    id: "submission",
    label: "IEEE Submission",
    summary: "Locked to the IEEE template: Times, no page numbers, plain links, standard spacing.",
  },
  {
    id: "draft",
    label: "IEEE Draft",
    summary: "IEEE layout plus review aids: page numbers, styled links, spacing presets and a DRAFT mark.",
  },
  {
    id: "custom",
    label: "Custom",
    summary: "Free styling, including fonts. Not IEEE-compliant — switch back before you submit.",
  },
];

/** Paper properties whose availability depends on the mode. */
export type ModeControlled = "fontFamily" | "showPageNumbers" | "linkStyle" | "spacingDensity" | "draftWatermark";

const ALLOWED_IN: Record<ModeControlled, StyleMode[]> = {
  fontFamily: ["custom"],
  showPageNumbers: ["draft", "custom"],
  linkStyle: ["draft", "custom"],
  spacingDensity: ["draft", "custom"],
  draftWatermark: ["draft"],
};

const LOCK_REASONS: Record<ModeControlled, string> = {
  fontFamily: "IEEE templates require Times New Roman. Switch to Custom mode to use another font.",
  showPageNumbers: "IEEE conference templates say \"Do not add page numbers\"; the publisher adds them.",
  linkStyle: "IEEE expects citations and cross-references in plain black text.",
  spacingDensity: "Submission mode keeps the template's standard spacing.",
  draftWatermark: "The DRAFT mark is only available in Draft mode.",
};

export function isAllowed(property: ModeControlled, mode: StyleMode): boolean {
  return ALLOWED_IN[property].includes(mode);
}

export function lockReason(property: ModeControlled): string {
  return LOCK_REASONS[property];
}

/**
 * Papers created before modes existed have no `mode`; pick the strictest
 * mode that still renders them exactly as before.
 */
export function inferMode(meta: Meta): StyleMode {
  if (meta.fontFamily && meta.fontFamily !== "times") return "custom";
  const usesDraftOptions =
    meta.showPageNumbers ||
    meta.linkStyle?.underline ||
    meta.linkStyle?.colored ||
    (meta.spacingDensity !== undefined && meta.spacingDensity !== "standard");
  return usesDraftOptions ? "draft" : "submission";
}

export function getMode(meta: Meta): StyleMode {
  return meta.mode ?? inferMode(meta);
}

/**
 * The meta the renderer should use: stored choices that the current mode
 * doesn't allow are ignored (not deleted), so switching back restores them.
 */
export function effectiveMeta(meta: Meta): Meta {
  const mode = getMode(meta);
  return {
    ...meta,
    mode,
    fontFamily: isAllowed("fontFamily", mode) ? meta.fontFamily : "times",
    showPageNumbers: isAllowed("showPageNumbers", mode) ? meta.showPageNumbers : false,
    linkStyle: isAllowed("linkStyle", mode) ? meta.linkStyle : undefined,
    spacingDensity: isAllowed("spacingDensity", mode) ? meta.spacingDensity : "standard",
    draftWatermark: isAllowed("draftWatermark", mode) ? meta.draftWatermark : false,
  };
}
