import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { XrefView } from "./XrefView";

// Same rationale as CiteRefExtension: atomic inline node so an existing
// cross-reference (e.g. in the sample paper's "Maintaining the Integrity"
// paragraph, which cites both Table I and Fig. 1) survives being edited
// through TipTap instead of being flattened away.
export const XrefExtension = Node.create({
  name: "xref",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      id: { default: null },
      targetType: { default: null },
      targetId: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-xref]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-xref": "" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(XrefView);
  },
});
