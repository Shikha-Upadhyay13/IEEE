import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";

export function XrefView({ node }: NodeViewProps) {
  const targetType = node.attrs.targetType as "figure" | "table";
  const targetId = node.attrs.targetId as string;
  const label = targetType === "figure" ? `Fig. ${targetId.replace(/^fig-/, "")}` : `Table ${targetId.replace(/^tbl-/, "")}`;

  return (
    <NodeViewWrapper as="span" className="inline" data-xref="">
      <span
        contentEditable={false}
        title={`Cross-reference to ${targetType} ${targetId}`}
        className="rounded px-1 text-[0.85em] bg-emerald-100 text-emerald-800"
      >
        {label}
      </span>
    </NodeViewWrapper>
  );
}
