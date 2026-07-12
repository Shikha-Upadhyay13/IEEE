import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useDocumentStore } from "../../../store/documentStore";

export function CiteRefView({ node }: NodeViewProps) {
  const refId = node.attrs.refId as string;
  const reference = useDocumentStore((s) => s.document.references.find((r) => r.id === refId));

  // NOT the true first-appearance citation number — that's computed
  // document-wide by numbering.ts (see resolveNumbering), which this
  // isolated per-paragraph editor instance has no visibility into. This is
  // just a stable, human-readable shorthand so the user can tell which
  // reference the chip points to while editing.
  const label = reference ? refId.replace(/^ref-/, "") : "missing ref";

  return (
    <NodeViewWrapper as="span" style={{ display: "inline" }} data-cite-ref="">
      <span
        contentEditable={false}
        title={reference?.renderedText ?? "This reference no longer exists"}
        style={{
          background: reference ? "#dbeafe" : "#fee2e2",
          borderRadius: 3,
          padding: "0 4px",
          fontSize: "0.85em",
        }}
      >
        [{label}]
      </span>
    </NodeViewWrapper>
  );
}
