import type { BodyNode } from "../../types/document";

export type XrefTarget = { id: string; targetType: "figure" | "table"; label: string };

// Walks the document body to list every figure/table so the editor can offer
// them in an "insert cross-reference" dropdown — same recursive traversal
// shape as numbering.ts's resolveBody, but collecting targets, not numbers.
export function collectXrefTargets(body: BodyNode[]): XrefTarget[] {
  const targets: XrefTarget[] = [];
  function walk(nodes: BodyNode[]) {
    for (const node of nodes) {
      if (node.type === "figure") {
        targets.push({ id: node.id, targetType: "figure", label: node.image.alt || node.id });
      } else if (node.type === "table") {
        const captionText = node.caption.find((c) => c.type === "text")?.text;
        targets.push({ id: node.id, targetType: "table", label: captionText || node.id });
      } else if (node.type === "section") {
        walk(node.children);
      }
    }
  }
  walk(body);
  return targets;
}
