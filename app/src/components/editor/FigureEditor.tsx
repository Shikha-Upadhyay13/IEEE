import { useState, type ChangeEvent } from "react";
import type { BodyNode, FigureAlign } from "../../types/document";
import { useDocumentStore } from "../../store/documentStore";
import { useAuth } from "../../lib/useAuth";
import { supabase } from "../../supabaseClient";
import { generateId } from "../../lib/id";
import { RichParagraphEditor } from "./richtext/RichParagraphEditor";

type Figure = Extract<BodyNode, { type: "figure" }>;

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
      <div className="flex gap-4 items-center flex-wrap text-xs text-gray-600 dark:text-gray-400">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={node.width === "double-column"}
            onChange={(e) =>
              updateFigureWidth(node.id, e.target.checked ? "double-column" : "single-column")
            }
            className="rounded border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-gray-400"
          />
          Span both columns
        </label>
        <label className="flex items-center gap-1.5">
          Size
          <input
            type="range"
            min={10}
            max={100}
            step={1}
            value={node.scale ?? 100}
            onChange={(e) => updateFigureScale(node.id, Number(e.target.value))}
            className="w-24 accent-gray-800 dark:accent-gray-300"
          />
          <span className="w-10 text-right tabular-nums text-gray-500 dark:text-gray-400">
            {node.scale ?? 100}%
          </span>
        </label>
      </div>

      {uploading && <p className="text-xs text-gray-500 dark:text-gray-400">Uploading…</p>}
      {uploadError && <p className="text-xs text-red-600 dark:text-red-400">{uploadError}</p>}

      {images.length > 0 && (
        <>
          {/* Right above the image it affects, not lumped in with unrelated
              width/size controls — "align what?" was the actual confusion. */}
          <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
            Align this image on the page:
            <select
              value={node.align ?? "center"}
              onChange={(e) => updateFigureAlign(node.id, e.target.value as FigureAlign)}
              className="rounded border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-gray-400"
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </label>
          <div className="flex gap-2 flex-wrap">
            {images.map((img, i) => (
              <div key={img.url + i} className="relative">
                <img
                  src={img.url}
                  alt={img.alt}
                  className="max-w-[140px] max-h-[100px] rounded border border-gray-200 dark:border-gray-700"
                />
                {images.length > 1 && (
                  <span className="absolute bottom-0.5 left-0.5 text-[10px] bg-white/80 dark:bg-gray-900/80 text-gray-800 dark:text-gray-200 px-1 rounded">
                    ({String.fromCharCode(97 + i)})
                  </span>
                )}
                <button
                  onClick={() => removeFigureImageAt(node.id, i)}
                  aria-label="Remove image"
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-600 text-xs flex items-center justify-center"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </>
      )}
      {images.length === 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500">No images uploaded yet.</p>
      )}

      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        disabled={uploading}
        className="text-xs text-gray-600 dark:text-gray-400 file:mr-2 file:rounded file:border-0 file:bg-gray-100 dark:file:bg-gray-800 file:px-2 file:py-1 file:text-xs file:font-medium file:text-gray-700 dark:file:text-gray-300 hover:file:bg-gray-200 dark:hover:file:bg-gray-700"
      />
      {images.length >= 1 && (
        <p className="text-[11px] text-gray-400 dark:text-gray-500">
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
