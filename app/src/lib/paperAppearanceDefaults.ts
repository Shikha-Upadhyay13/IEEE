import type { Document } from "../types/document";

const STORAGE_KEY = "paper-appearance-defaults";

export type AppearanceDefaults = Pick<
  Document["meta"],
  "accentColor" | "accentTargets" | "linkStyle" | "spacingDensity"
>;

// Per-device "carry this look into new papers" preference, set explicitly via
// the Appearance panel's "Set as default for new papers" action (see
// AppearancePanel.tsx) — never inferred automatically, and never touches a
// document that already exists. Read once, by createBlankDocument, at the
// moment a new paper is created.
export function getAppearanceDefaults(): AppearanceDefaults | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveAppearanceDefaults(defaults: AppearanceDefaults): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
}

export function clearAppearanceDefaults(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}
