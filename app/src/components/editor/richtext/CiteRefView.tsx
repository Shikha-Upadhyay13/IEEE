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
    <NodeViewWrapper as="span" className="inline" data-cite-ref="">
      <span
        contentEditable={false}
        title={reference?.renderedText ?? "This reference no longer exists"}
        className={`rounded px-1 text-[0.85em] ${
          reference
            ? "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
            : "bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400"
        }`}
      >
        [{label}]
      </span>
    </NodeViewWrapper>
  );
}
