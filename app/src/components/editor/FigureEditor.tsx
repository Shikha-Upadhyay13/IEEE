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
    <div className="flex flex-col gap-2">
      <div className="flex gap-3 items-center flex-wrap">
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={uploading}
          className="text-xs text-gray-600 file:mr-2 file:rounded file:border-0 file:bg-gray-100 file:px-2 file:py-1 file:text-xs file:font-medium file:text-gray-700 hover:file:bg-gray-200"
        />
        <label className="flex items-center gap-1.5 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={node.width === "double-column"}
            onChange={(e) =>
              updateFigureWidth(node.id, e.target.checked ? "double-column" : "single-column")
            }
            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          Span both columns
        </label>
      </div>
      {uploading && <p className="text-xs text-gray-500">Uploading…</p>}
      {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
      {node.image.url ? (
        <img
          src={node.image.url}
          alt={node.image.alt}
          className="max-w-[200px] max-h-[120px] rounded border border-gray-200"
        />
      ) : (
        <p className="text-xs text-gray-400">No image uploaded yet.</p>
      )}
      <RichParagraphEditor
        content={node.caption}
        onChange={(caption) => updateFigureCaption(node.id, caption)}
      />
    </div>
  );
}
