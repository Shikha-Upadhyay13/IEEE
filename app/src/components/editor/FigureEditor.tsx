import { useState, type ChangeEvent } from "react";
import type { BodyNode } from "../../types/document";
import { useDocumentStore } from "../../store/documentStore";
import { useAuth } from "../../lib/useAuth";
import { supabase } from "../../supabaseClient";
import { generateId } from "../../lib/id";
import { RichParagraphEditor } from "./richtext/RichParagraphEditor";

type Figure = Extract<BodyNode, { type: "figure" }>;

export function FigureEditor({ node }: { node: Figure }) {
  const updateFigureImage = useDocumentStore((s) => s.updateFigureImage);
  const updateFigureCaption = useDocumentStore((s) => s.updateFigureCaption);
  const updateFigureWidth = useDocumentStore((s) => s.updateFigureWidth);
  const documentId = useDocumentStore((s) => s.documentId);
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user || !documentId) return;

    setUploading(true);
    setUploadError(null);
    try {
      const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
      // Path prefix (first segment = the uploading user's id) is exactly what
      // the storage RLS policies check — see supabase/schema.sql.
      const path = `${user.id}/${documentId}/${generateId("img")}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("figures").upload(path, file);
      if (uploadErr) throw uploadErr;

      const { data } = supabase.storage.from("figures").getPublicUrl(path);
      updateFigureImage(node.id, { url: data.publicUrl, alt: file.name });
    } catch (err) {
      console.error("Figure upload failed:", err);
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="file" accept="image/*" onChange={handleFileChange} disabled={uploading} />
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
      {uploading && <p style={{ fontSize: 12, color: "#888" }}>Uploading…</p>}
      {uploadError && <p style={{ fontSize: 12, color: "red" }}>{uploadError}</p>}
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
