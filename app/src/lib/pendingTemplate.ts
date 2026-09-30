import { STARTER_TEMPLATES, type StarterTemplateId } from "./starterTemplates";

export type GalleryChoice = StarterTemplateId | "sample";

const KEY = "ieee:pendingTemplate";

function isGalleryChoice(value: string | null): value is GalleryChoice {
  return value === "sample" || STARTER_TEMPLATES.some((t) => t.id === value);
}

/** Remembers a template picked on the public gallery across the sign-in redirect. */
export function setPendingTemplate(choice: GalleryChoice) {
  try {
    sessionStorage.setItem(KEY, choice);
  } catch {
    // Private mode or storage disabled: the user just lands on the dashboard.
  }
}

export function takePendingTemplate(): GalleryChoice | null {
  try {
    const value = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return isGalleryChoice(value) ? value : null;
  } catch {
    return null;
  }
}
