import type { JSONContent } from "@tiptap/core";
import type { InlineNode } from "../../types/document";
import { generateId } from "../id";

/**
 * Converts our InlineNode[] (the schema's inline content model) to a TipTap
 * document JSON, and back. citeRef/xref nodes carry their own `id` in their
 * TipTap attrs so it round-trips stably instead of getting a fresh id (and
 * therefore a fresh React key) on every keystroke.
 */
export function inlineNodesToTipTapDoc(nodes: InlineNode[]): JSONContent {
  const content: JSONContent[] = nodes.map((node) => {
    if (node.type === "text") {
      const marks: JSONContent["marks"] = [];
      if (node.bold) marks.push({ type: "bold" });
      if (node.italic) marks.push({ type: "italic" });
      if (node.superscript) marks.push({ type: "superscript" });
      return marks.length > 0 ? { type: "text", text: node.text, marks } : { type: "text", text: node.text };
    }
    if (node.type === "citeRef") {
      return { type: "citeRef", attrs: { id: node.id, refId: node.refId } };
    }
    return { type: "xref", attrs: { id: node.id, targetType: node.targetType, targetId: node.targetId } };
  });

  return {
    type: "doc",
    // ProseMirror rejects a paragraph node with a present-but-empty content array.
    content: [{ type: "paragraph", content: content.length > 0 ? content : undefined }],
  };
}

export function tipTapDocToInlineNodes(doc: JSONContent): InlineNode[] {
  const inlineContent = doc?.content?.[0]?.content ?? [];
  const result: InlineNode[] = [];

  for (const node of inlineContent) {
    if (node.type === "text") {
      const marks = node.marks ?? [];
      result.push({
        type: "text",
        text: node.text ?? "",
        bold: marks.some((m) => m.type === "bold") || undefined,
        italic: marks.some((m) => m.type === "italic") || undefined,
        superscript: marks.some((m) => m.type === "superscript") || undefined,
      });
    } else if (node.type === "citeRef" && node.attrs) {
      result.push({
        type: "citeRef",
        id: (node.attrs.id as string) ?? generateId("cite"),
        refId: node.attrs.refId as string,
      });
    } else if (node.type === "xref" && node.attrs) {
      result.push({
        type: "xref",
        id: (node.attrs.id as string) ?? generateId("xref"),
        targetType: node.attrs.targetType as "figure" | "table",
        targetId: node.attrs.targetId as string,
      });
    }
  }
  return result;
}
