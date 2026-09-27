import type { BodyNode, InlineNode } from "../../types/document";

export type XrefTarget = { id: string; targetType: "figure" | "table"; label: string };

function captionText(caption: InlineNode[]): string {
  return caption
    .map((n) => (n.type === "text" ? n.text : ""))
    .join("")
    .trim();
}

// Walks the document body to list every figure/table so the editor can offer
// them in an "insert cross-reference" dropdown — same recursive traversal
// shape as numbering.ts's resolveBody, but collecting targets, not numbers.
export function collectXrefTargets(body: BodyNode[]): XrefTarget[] {
  const targets: XrefTarget[] = [];
  function walk(nodes: BodyNode[]) {
    for (const node of nodes) {
      if (node.type === "figure") {
        const firstImage = node.images?.[0] ?? node.image; // node.image is the pre-multi-image legacy field
        targets.push({
          id: node.id,
          targetType: "figure",
          label: captionText(node.caption) || firstImage?.alt || "Untitled figure",
        });
      } else if (node.type === "table") {
        targets.push({ id: node.id, targetType: "table", label: captionText(node.caption) || "Untitled table" });
      } else if (node.type === "section") {
        walk(node.children);
      }
    }
  }
  walk(body);
  return targets;
}
