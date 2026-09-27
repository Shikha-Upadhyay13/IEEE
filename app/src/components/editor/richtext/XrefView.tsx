import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useDocumentStore } from "../../../store/documentStore";
import { xrefLabelFor } from "../../../lib/richtext/liveNumbers";

export function XrefView({ node }: NodeViewProps) {
  const targetType = node.attrs.targetType as "figure" | "table";
  const targetId = node.attrs.targetId as string;
  const resolvedLabel = useDocumentStore((s) => xrefLabelFor(s.document, targetType, targetId));
  const accentColor = useDocumentStore((s) => s.document.meta.accentColor);
  const accentTargets = useDocumentStore((s) => s.document.meta.accentTargets);
  const accent = accentTargets?.citationChips && accentColor && resolvedLabel ? accentColor : null;

  const label = resolvedLabel ?? `[missing ${targetType}]`;

  return (
    <NodeViewWrapper as="span" className="inline" data-xref="">
      <span
        contentEditable={false}
        title={resolvedLabel ? `Cross-reference to ${resolvedLabel}` : `This ${targetType} no longer exists`}
        style={accent ? { backgroundColor: `${accent}26`, color: accent } : undefined}
        className={`rounded px-1 text-[0.85em] ${
          accent
            ? ""
            : resolvedLabel
              ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300"
              : "bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400"
        }`}
      >
        {label}
      </span>
    </NodeViewWrapper>
  );
}
