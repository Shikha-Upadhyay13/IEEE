import { useMemo } from "react";
import { useDocumentStore } from "../../store/documentStore";
import { runChecklist, type ChecklistItem, type ChecklistStatus } from "../../lib/checklist";
import { figureImages } from "../../lib/figureResolution";
import { useImageWidths } from "../../lib/useImageWidths";
import type { BodyNode } from "../../types/document";

const STATUS_ORDER: Record<ChecklistStatus, number> = { fail: 0, warn: 1, info: 2, pass: 3 };

/** The submission checklist for the open paper, most severe first. */
export function useChecklist(pageCount: number | null): ChecklistItem[] {
  const document = useDocumentStore((s) => s.document);

  const imageUrls = useMemo(() => {
    const urls: string[] = [];
    const visit = (nodes: BodyNode[]) => {
      for (const node of nodes) {
        if (node.type === "section") visit(node.children);
        else if (node.type === "figure") urls.push(...figureImages(node).map((img) => img.url));
      }
    };
    visit(document.body);
    return urls;
  }, [document.body]);
  const imageWidths = useImageWidths(imageUrls);

  return useMemo(
    () =>
      [...runChecklist(document, pageCount, imageWidths)].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]),
    [document, pageCount, imageWidths],
  );
}
