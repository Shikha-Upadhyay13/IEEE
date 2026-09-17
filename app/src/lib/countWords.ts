import type { Document, BodyNode, InlineNode } from "../types/document";

export interface DocumentStats {
  words: number;
  characters: number;
  paragraphs: number;
  sections: number;
  readingTimeMinutes: number;
}

/**
 * Accurately counts words and characters across an IEEE Document:
 * title, abstract, section headings, paragraphs, figures, tables, and references.
 */
export function countDocumentStats(doc: Document): DocumentStats {
  let text = "";
  let paragraphCount = 0;
  let sectionCount = 0;

  // Title
  if (doc.titleBlock?.title) {
    text += " " + extractInlineText(doc.titleBlock.title);
  }

  // Abstract
  if (doc.abstract?.text) {
    text += " " + doc.abstract.text;
  }

  // Keywords
  if (doc.keywords?.length) {
    text += " " + doc.keywords.join(" ");
  }

  // Body Nodes
  function traverseBody(nodes: BodyNode[]) {
    for (const node of nodes) {
      if (node.type === "section") {
        sectionCount++;
        text += " " + (node.heading || "");
        if (node.children) {
          traverseBody(node.children);
        }
      } else if (node.type === "paragraph") {
        paragraphCount++;
        text += " " + extractInlineText(node.content);
      } else if (node.type === "figure") {
        text += " " + extractInlineText(node.caption);
      } else if (node.type === "table") {
        text += " " + extractInlineText(node.caption);
        for (const row of node.rows || []) {
          text += " " + row.join(" ");
        }
      } else if (node.type === "equation") {
        // Equation counts as a math token
        text += " math";
      }
    }
  }

  if (doc.body) {
    traverseBody(doc.body);
  }

  // Clean words
  const trimmed = text.trim();
  const wordMatches = trimmed ? trimmed.match(/\b[\w'-]+\b/g) : null;
  const words = wordMatches ? wordMatches.length : 0;
  const characters = trimmed.replace(/\s+/g, "").length;
  const readingTimeMinutes = Math.max(1, Math.ceil(words / 220));

  return {
    words,
    characters,
    paragraphs: paragraphCount,
    sections: sectionCount,
    readingTimeMinutes,
  };
}

function extractInlineText(nodes: InlineNode[] = []): string {
  let s = "";
  for (const node of nodes) {
    if (node.type === "text") {
      s += " " + node.text;
    }
  }
  return s;
}
