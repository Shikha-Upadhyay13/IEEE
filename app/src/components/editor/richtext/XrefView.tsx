import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";

export function XrefView({ node }: NodeViewProps) {
  const targetType = node.attrs.targetType as "figure" | "table";
  const targetId = node.attrs.targetId as string;
  const label = targetType === "figure" ? `Fig. ${targetId.replace(/^fig-/, "")}` : `Table ${targetId.replace(/^tbl-/, "")}`;

  return (
    <NodeViewWrapper as="span" style={{ display: "inline" }} data-xref="">
      <span
        contentEditable={false}
        title={`Cross-reference to ${targetType} ${targetId}`}
        style={{ background: "#dcfce7", borderRadius: 3, padding: "0 4px", fontSize: "0.85em" }}
      >
        {label}
      </span>
    </NodeViewWrapper>
  );
}
