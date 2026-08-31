import type { Document } from "../types/document";

// Flattens the title block's inline nodes back into a plain string — used
// wherever a document needs a display/file title outside its own rendered
// preview (the dashboard listing, export filenames, the command palette).
export function extractTitleText(doc: Document): string {
  return doc.titleBlock.title.map((n) => (n.type === "text" ? n.text : "")).join("") || "Untitled paper";
}
