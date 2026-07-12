import type { ChangeEvent } from "react";
import type { BodyNode } from "../../types/document";
import { useDocumentStore } from "../../store/documentStore";
import { RichParagraphEditor } from "./richtext/RichParagraphEditor";

type Figure = Extract<BodyNode, { type: "figure" }>;

export function FigureEditor({ node }: { node: Figure }) {
  const updateFigureImage = useDocumentStore((s) => s.updateFigureImage);
  const updateFigureCaption = useDocumentStore((s) => s.updateFigureCaption);
  const updateFigureWidth = useDocumentStore((s) => s.updateFigureWidth);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Local-only for now (URL.createObjectURL, valid for this browser session).
    // Real persisted storage (Supabase Storage) arrives in Milestone 6 alongside
    // document persistence — uploading to cloud storage before anything actually
    // saves the document that references it would be a half-built feature.
    const objectUrl = URL.createObjectURL(file);
    updateFigureImage(node.id, { url: objectUrl, alt: file.name });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="file" accept="image/*" onChange={handleFileChange} />
        <label style={{ fontSize: 12 }}>
          <input
            type="checkbox"
            checked={node.width === "double-column"}
            onChange={(e) =>
              updateFigureWidth(node.id, e.target.checked ? "double-column" : "single-column")
            }
          />
          Span both columns
        </label>
      </div>
      {node.image.url ? (
        <img src={node.image.url} alt={node.image.alt} style={{ maxWidth: 200, maxHeight: 120 }} />
      ) : (
        <p style={{ color: "#888", fontSize: 12 }}>No image uploaded yet.</p>
      )}
      <RichParagraphEditor
        content={node.caption}
        onChange={(caption) => updateFigureCaption(node.id, caption)}
      />
    </div>
  );
}
