import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { CiteRefView } from "./CiteRefView";

// Atomic inline node: not directly editable as text (you can't place a cursor
// inside "[1]" and type), deleted/selected as a single unit — matching how a
// citation actually behaves conceptually, and how our InlineNode schema
// already models it (a citeRef node, not literal bracket characters).
export const CiteRefExtension = Node.create({
  name: "citeRef",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      id: { default: null },
      refId: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-cite-ref]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-cite-ref": "" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CiteRefView);
  },
});
