import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useDocumentStore } from "../../../store/documentStore";

export function XrefView({ node }: NodeViewProps) {
  const targetType = node.attrs.targetType as "figure" | "table";
  const targetId = node.attrs.targetId as string;
  const label = targetType === "figure" ? `Fig. ${targetId.replace(/^fig-/, "")}` : `Table ${targetId.replace(/^tbl-/, "")}`;
  const accentColor = useDocumentStore((s) => s.document.meta.accentColor);
  const accentTargets = useDocumentStore((s) => s.document.meta.accentTargets);
  const accent = accentTargets?.citationChips && accentColor ? accentColor : null;

  return (
    <NodeViewWrapper as="span" className="inline" data-xref="">
      <span
        contentEditable={false}
        title={`Cross-reference to ${targetType} ${targetId}`}
        style={accent ? { backgroundColor: `${accent}26`, color: accent } : undefined}
        className={`rounded px-1 text-[0.85em] ${
          accent ? "" : "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300"
        }`}
      >
        {label}
      </span>
    </NodeViewWrapper>
  );
}
