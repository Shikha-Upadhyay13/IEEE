import type { Document } from "../types/document";

// A genuinely empty starting point for a new paper — the sample paper (used
// only for local/unauthenticated dev testing) is deliberately not the
// default here, since a new user's first document should start blank.
export function createBlankDocument(): Document {
  return {
    schemaVersion: 1,
    meta: { template: "ieee-conference", paperSize: "letter", pageLimit: null },
    titleBlock: {
      title: [{ type: "text", text: "Untitled Paper" }],
      authors: [],
      affiliations: [],
    },
    abstract: { text: "" },
    keywords: [],
    body: [],
    references: [],
  };
}
