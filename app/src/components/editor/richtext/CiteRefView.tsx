import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useDocumentStore } from "../../../store/documentStore";
import { citationNumberFor } from "../../../lib/richtext/liveNumbers";

export function CiteRefView({ node }: NodeViewProps) {
  const refId = node.attrs.refId as string;
  const reference = useDocumentStore((s) => s.document.references.find((r) => r.id === refId));
  const number = useDocumentStore((s) => citationNumberFor(s.document, refId));
  const accentColor = useDocumentStore((s) => s.document.meta.accentColor);
  const accentTargets = useDocumentStore((s) => s.document.meta.accentTargets);
  const accent = accentTargets?.citationChips && accentColor && reference ? accentColor : null;

  const label = reference && number !== null ? `[${number}]` : "[missing ref]";

  return (
    <NodeViewWrapper as="span" className="inline" data-cite-ref="">
      <span
        contentEditable={false}
        title={reference ? reference.renderedText || "Empty reference — fill in its details under References" : "This reference no longer exists"}
        style={accent ? { backgroundColor: `${accent}26`, color: accent } : undefined}
        className={`rounded px-1 text-[0.85em] ${
          accent
            ? ""
            : reference
              ? "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
              : "bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400"
        }`}
      >
        {label}
      </span>
    </NodeViewWrapper>
  );
}
