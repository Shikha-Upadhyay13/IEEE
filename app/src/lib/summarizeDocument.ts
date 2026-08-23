import type { BodyNode, Document, InlineNode } from "../types/document";

function extractText(nodes: InlineNode[]): string {
  return nodes.map((n) => (n.type === "text" ? n.text : "")).join("");
}

// Body content can run long, and every extra token here is one the model
// pays attention-budget for on every single turn of the conversation (this
// context is re-sent with each request, not summarized once by the model
// itself) — capping per-paragraph length keeps a large paper's context from
// silently crowding out the actual chat history.
const MAX_PARAGRAPH_CHARS = 500;

function summarizeBody(nodes: BodyNode[], depth = 0): string[] {
  const indent = "  ".repeat(depth);
  const lines: string[] = [];
  for (const node of nodes) {
    if (node.type === "section") {
      lines.push(`${indent}## ${node.heading}`);
      lines.push(...summarizeBody(node.children, depth + 1));
    } else if (node.type === "paragraph") {
      const text = extractText(node.content).trim();
      if (text) lines.push(`${indent}${text.slice(0, MAX_PARAGRAPH_CHARS)}`);
    } else if (node.type === "figure") {
      const caption = extractText(node.caption).trim();
      lines.push(`${indent}[Figure${caption ? `: ${caption}` : ""}]`);
    } else if (node.type === "table") {
      const caption = extractText(node.caption).trim();
      lines.push(`${indent}[Table${caption ? `: ${caption}` : ""}]`);
    }
  }
  return lines;
}

/**
 * Renders a Document as plain text for the AI assistant's system-prompt
 * context — deliberately lossy (no citation/xref numbers, no figure image
 * data) since the assistant only needs enough to give content-relevant
 * suggestions, not to reproduce the paper.
 */
export function summarizeDocumentForContext(doc: Document): string {
  const title = extractText(doc.titleBlock.title).trim() || "Untitled paper";
  const parts = [`Title: ${title}`];

  if (doc.keywords.length > 0) parts.push(`Keywords: ${doc.keywords.join(", ")}`);
  if (doc.abstract.text.trim()) parts.push(`Abstract: ${doc.abstract.text.trim()}`);

  const bodyLines = summarizeBody(doc.body);
  if (bodyLines.length > 0) parts.push(`Body:\n${bodyLines.join("\n")}`);

  return parts.join("\n\n");
}
