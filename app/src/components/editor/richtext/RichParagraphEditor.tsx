import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Superscript from "@tiptap/extension-superscript";
import { CiteRefExtension } from "./citeRefExtension";
import { XrefExtension } from "./xrefExtension";
import { inlineNodesToTipTapDoc, tipTapDocToInlineNodes } from "../../../lib/richtext/inlineNodeConversion";
import { collectXrefTargets } from "../../../lib/richtext/collectTargets";
import { useDocumentStore } from "../../../store/documentStore";
import { generateId } from "../../../lib/id";
import type { InlineNode } from "../../../types/document";

export function RichParagraphEditor({
  content,
  onChange,
}: {
  content: InlineNode[];
  onChange: (content: InlineNode[]) => void;
}) {
  const references = useDocumentStore((s) => s.document.references);
  const body = useDocumentStore((s) => s.document.body);
  const xrefTargets = collectXrefTargets(body);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Only formatting marks + the paragraph wrapper matter here — block-
        // level concerns (headings, lists, structure) belong to the block
        // editor's own drag-and-drop model, not inside one paragraph's text.
        heading: false,
        bulletList: false,
        orderedList: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      Superscript,
      CiteRefExtension,
      XrefExtension,
    ],
    // `content` here only seeds the editor once (useEditor's default deps are
    // []) — this component only ever writes to the store, never the reverse,
    // so there's no external-change case to sync back in for this milestone.
    content: inlineNodesToTipTapDoc(content),
    onUpdate: ({ editor }) => onChange(tipTapDocToInlineNodes(editor.getJSON())),
  });

  function insertCitation(refId: string) {
    if (!refId || !editor) return;
    editor
      .chain()
      .focus()
      .insertContent({ type: "citeRef", attrs: { id: generateId("cite"), refId } })
      .run();
  }

  function insertXref(targetKey: string) {
    if (!targetKey || !editor) return;
    const [targetType, targetId] = targetKey.split(":");
    editor
      .chain()
      .focus()
      .insertContent({ type: "xref", attrs: { id: generateId("xref"), targetType, targetId } })
      .run();
  }

  if (!editor) return null;

  return (
    <div data-rich-paragraph-editor="" style={{ border: "1px solid #ccc", borderRadius: 4, padding: 4 }}>
      <div style={{ display: "flex", gap: 4, marginBottom: 4, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          style={{ fontWeight: editor.isActive("bold") ? "bold" : "normal" }}
        >
          B
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          style={{ fontStyle: editor.isActive("italic") ? "italic" : "normal" }}
        >
          I
        </button>
        <select value="" onChange={(e) => insertCitation(e.target.value)} disabled={references.length === 0}>
          <option value="">+ Citation…</option>
          {references.map((ref) => (
            <option key={ref.id} value={ref.id}>
              {ref.id.replace(/^ref-/, "")}
            </option>
          ))}
        </select>
        <select value="" onChange={(e) => insertXref(e.target.value)} disabled={xrefTargets.length === 0}>
          <option value="">+ Cross-ref…</option>
          {xrefTargets.map((t) => (
            <option key={t.id} value={`${t.targetType}:${t.id}`}>
              [{t.targetType}] {t.label}
            </option>
          ))}
        </select>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
