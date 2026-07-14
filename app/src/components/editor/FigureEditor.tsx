import { useState, type ChangeEvent } from "react";
import type { BodyNode, FigureAlign } from "../../types/document";
import { useDocumentStore } from "../../store/documentStore";
import { useAuth } from "../../lib/useAuth";
import { supabase } from "../../supabaseClient";
import { generateId } from "../../lib/id";
import { RichParagraphEditor } from "./richtext/RichParagraphEditor";

type Figure = Extract<BodyNode, { type: "figure" }>;

const SCALE_PRESETS: { label: string; value: number }[] = [
  { label: "Small", value: 40 },
  { label: "Medium", value: 70 },
  { label: "Large", value: 100 },
];

export function FigureEditor({ node }: { node: Figure }) {
  const addFigureImage = useDocumentStore((s) => s.addFigureImage);
  const removeFigureImageAt = useDocumentStore((s) => s.removeFigureImageAt);
  const updateFigureCaption = useDocumentStore((s) => s.updateFigureCaption);
  const updateFigureWidth = useDocumentStore((s) => s.updateFigureWidth);
  const updateFigureScale = useDocumentStore((s) => s.updateFigureScale);
  const updateFigureAlign = useDocumentStore((s) => s.updateFigureAlign);
  const documentId = useDocumentStore((s) => s.documentId);
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Images predating this field live in the raw (unresolved) store document
  // as the old `image` singular — normalized here too, not just in
  // numbering.ts, since the editor reads the raw document, not the resolved one.
  const images = node.images && node.images.length > 0 ? node.images : node.image ? [node.image] : [];

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
      addFigureImage(node.id, { url: data.publicUrl, alt: file.name });
    } catch (err) {
      console.error("Figure upload failed:", err);
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
    e.target.value = ""; // allow re-selecting the same file for another slot
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-4 items-center flex-wrap text-xs text-gray-600">
        <label className="flex items-center gap-1.5">
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
        <label className="flex items-center gap-1.5">
          Size
          <select
            value={SCALE_PRESETS.find((p) => p.value === (node.scale ?? 100)) ? node.scale ?? 100 : 100}
            onChange={(e) => updateFigureScale(node.id, Number(e.target.value))}
            className="rounded border-gray-200 px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          >
            {SCALE_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          Align
          <select
            value={node.align ?? "center"}
            onChange={(e) => updateFigureAlign(node.id, e.target.value as FigureAlign)}
            className="rounded border-gray-200 px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </label>
      </div>

      {uploading && <p className="text-xs text-gray-500">Uploading…</p>}
      {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}

      {images.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {images.map((img, i) => (
            <div key={img.url + i} className="relative">
              <img
                src={img.url}
                alt={img.alt}
                className="max-w-[140px] max-h-[100px] rounded border border-gray-200"
              />
              {images.length > 1 && (
                <span className="absolute bottom-0.5 left-0.5 text-[10px] bg-white/80 px-1 rounded">
                  ({String.fromCharCode(97 + i)})
                </span>
              )}
              <button
                onClick={() => removeFigureImageAt(node.id, i)}
                aria-label="Remove image"
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-gray-300 text-gray-500 hover:text-red-600 hover:border-red-300 text-xs flex items-center justify-center"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      {images.length === 0 && <p className="text-xs text-gray-400">No images uploaded yet.</p>}

      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        disabled={uploading}
        className="text-xs text-gray-600 file:mr-2 file:rounded file:border-0 file:bg-gray-100 file:px-2 file:py-1 file:text-xs file:font-medium file:text-gray-700 hover:file:bg-gray-200"
      />
      {images.length >= 1 && (
        <p className="text-[11px] text-gray-400">
          Uploading another image adds a subfigure — labeled (a), (b), … automatically.
        </p>
      )}

      <RichParagraphEditor
        content={node.caption}
        onChange={(caption) => updateFigureCaption(node.id, caption)}
      />
    </div>
  );
}
