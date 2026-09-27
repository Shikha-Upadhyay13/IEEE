import type { Document } from "../types/document";
import { getAppearanceDefaults } from "./paperAppearanceDefaults";
import { buildTemplateBody, type StarterTemplateId } from "./starterTemplates";

// A starter skeleton for a new paper — not a truly empty document, since a
// first-time user staring at a completely blank editor has no sense of what
// an IEEE paper's structure should look like (that's the exact knowledge gap
// this tool exists to remove). See starterTemplates.ts for the section
// structure of each paper type.
export function createBlankDocument(template: StarterTemplateId = "conference"): Document {
  // Carries over accent color/link style/spacing from a saved "set as
  // default for new papers" choice (see AppearancePanel.tsx) — absent for
  // anyone who's never used that action, in which case this is a no-op and
  // the document gets the same guaranteed-compliant defaults as always.
  const appearanceDefaults = getAppearanceDefaults();
  return {
    schemaVersion: 1,
    meta: { template: "ieee-conference", paperSize: "letter", pageLimit: null, ...appearanceDefaults },
    titleBlock: {
      title: [{ type: "text", text: "Untitled Paper" }],
      authors: [],
      affiliations: [],
    },
    abstract: { text: "" },
    keywords: [],
    body: buildTemplateBody(template),
    references: [],
  };
}
