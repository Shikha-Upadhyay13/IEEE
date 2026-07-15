import type { Document } from "../types/document";
import { generateId } from "./id";

// A starter skeleton for a new paper — not a truly empty document, since a
// first-time user staring at a completely blank editor has no sense of what
// an IEEE paper's structure should look like (that's the exact knowledge gap
// this tool exists to remove). Section headings and their placeholder
// paragraphs follow the same "New X — do Y" instructional voice already used
// elsewhere (appendParagraph/appendFigure/appendTable's placeholder text),
// so they read as obviously-replace-this, not as accidental leftover content.
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
    body: [
      {
        type: "section",
        id: generateId("sec"),
        heading: "Introduction",
        level: 1,
        children: [
          {
            type: "paragraph",
            id: generateId("p"),
            content: [
              {
                type: "text",
                text: "Introduce the problem, briefly cover related work, and state this paper's contribution.",
              },
            ],
          },
        ],
      },
      {
        type: "section",
        id: generateId("sec"),
        heading: "Methodology",
        level: 1,
        children: [
          {
            type: "paragraph",
            id: generateId("p"),
            content: [
              { type: "text", text: "Describe your approach, system design, or experimental setup." },
            ],
          },
        ],
      },
      {
        type: "section",
        id: generateId("sec"),
        heading: "Results",
        level: 1,
        children: [
          {
            type: "paragraph",
            id: generateId("p"),
            content: [{ type: "text", text: "Present your results, findings, or evaluation." }],
          },
        ],
      },
      {
        type: "section",
        id: generateId("sec"),
        heading: "Conclusion",
        level: 1,
        children: [
          {
            type: "paragraph",
            id: generateId("p"),
            content: [
              { type: "text", text: "Summarize your contribution and discuss possible future work." },
            ],
          },
        ],
      },
    ],
    references: [],
  };
}
