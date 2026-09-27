import { useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { Quote } from "lucide-react";
import { Menu, type MenuItem } from "../../ui/Menu";
import StarterKit from "@tiptap/starter-kit";
import Superscript from "@tiptap/extension-superscript";
import Placeholder from "@tiptap/extension-placeholder";
import { CiteRefExtension } from "./citeRefExtension";
import { XrefExtension } from "./xrefExtension";
import { inlineNodesToTipTapDoc, tipTapDocToInlineNodes } from "../../../lib/richtext/inlineNodeConversion";
import { collectXrefTargets } from "../../../lib/richtext/collectTargets";
import { citationNumberFor, xrefLabelFor } from "../../../lib/richtext/liveNumbers";
import { useDocumentStore } from "../../../store/documentStore";
import { generateId } from "../../../lib/id";
import type { InlineNode, Reference } from "../../../types/document";

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function referenceLabel(ref: Reference): { label: string; description?: string } {
  const authors = ref.fields.authors?.trim();
  const title = ref.fields.title?.trim();
  if (authors || title) {
    return { label: truncate(authors || title || "", 60), description: authors && title ? title : undefined };
  }
  const rendered = ref.renderedText.trim();
  return rendered
    ? { label: truncate(rendered, 60) }
    : { label: "Empty reference", description: "Fill in its details under References" };
}

export function RichParagraphEditor({
  content,
  onChange,
}: {
  content: InlineNode[];
  onChange: (content: InlineNode[]) => void;
}) {
  const document = useDocumentStore((s) => s.document);
  const references = document.references;
  const hasBeenFocused = useRef(false);
  const citationItems: MenuItem[] = references
    .map((ref) => {
      const n = citationNumberFor(document, ref.id);
      const { label, description } = referenceLabel(ref);
      return { id: ref.id, n: n ?? 0, label: `[${n ?? "?"}] ${label}`, description };
    })
    .sort((a, b) => a.n - b.n)
    .map(({ id, label, description }) => ({ id, label, description, onSelect: () => insertCitation(id) }));
  const xrefTargets = collectXrefTargets(document.body).map((t) => ({
    ...t,
    label: `${xrefLabelFor(document, t.targetType, t.id) ?? t.targetType} — ${truncate(t.label, 50)}`,
  }));

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
      // Matches the Title/Abstract fields' hint-text treatment instead of
      // seeding new paragraphs with real placeholder text the user has to
      // notice and delete before writing their own content.
      Placeholder.configure({ placeholder: "Write your paragraph here…" }),
    ],
    // `content` here only seeds the editor once (useEditor's default deps are
    // []) — this component only ever writes to the store, never the reverse,
    // so there's no external-change case to sync back in for this milestone.
    content: inlineNodesToTipTapDoc(content),
    onUpdate: ({ editor }) => onChange(tipTapDocToInlineNodes(editor.getJSON())),
    onFocus: () => {
      hasBeenFocused.current = true;
    },
  });

  // Until the paragraph has been clicked into, TipTap's cursor sits at the
  // very start — inserting there would glue the chip onto the first word
  // ("[1]Introduce the problem..."), so fall back to the end instead. Once
  // the user has placed a cursor, focus() restores that exact selection.
  function insertInline(node: { type: "citeRef" | "xref"; attrs: Record<string, string> }) {
    if (!editor) return;
    editor
      .chain()
      .focus(hasBeenFocused.current ? undefined : "end")
      .insertContent(node)
      .run();
  }

  function insertCitation(refId: string) {
    insertInline({ type: "citeRef", attrs: { id: generateId("cite"), refId } });
  }

  function insertXref(targetKey: string) {
    if (!targetKey) return;
    const [targetType, targetId] = targetKey.split(":");
    insertInline({ type: "xref", attrs: { id: generateId("xref"), targetType, targetId } });
  }

  if (!editor) return null;

  const toolbarBtn = (active: boolean) =>
    `w-7 h-7 rounded flex items-center justify-center text-sm font-semibold transition-colors ${
      active
        ? "bg-accent-soft text-accent"
        : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
    }`;
  const toolbarMenuBtn =
    "h-7 inline-flex items-center gap-1 rounded px-2 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 aria-expanded:bg-accent-soft aria-expanded:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent";
  const toolbarSelect =
    "h-7 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-1.5 text-xs text-gray-600 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50 dark:disabled:bg-gray-800";

  return (
    <div
      data-rich-paragraph-editor=""
      className="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500"
    >
      <div className="flex gap-1 flex-wrap items-center px-2 py-1.5 border-b border-gray-100 dark:border-gray-800">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={toolbarBtn(editor.isActive("bold"))}
          aria-label="Bold"
        >
          B
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`${toolbarBtn(editor.isActive("italic"))} italic`}
          aria-label="Italic"
        >
          I
        </button>
        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1" />
        <Menu
          trigger={
            <>
              <Quote size={13} aria-hidden="true" />
              Cite
            </>
          }
          title="Insert a citation at the cursor"
          triggerClassName={toolbarMenuBtn}
          width={320}
          groups={[{ label: "References", items: citationItems }]}
          emptyMessage="No references yet — add one in the References panel below."
        />
        <select
          value=""
          onChange={(e) => insertXref(e.target.value)}
          title="Insert a cross-reference to a figure or table"
          className={toolbarSelect}
        >
          <option value="">+ Cross-ref…</option>
          {xrefTargets.length === 0 && (
            <option value="" disabled>
              No figures or tables yet — add one with + Add block
            </option>
          )}
          {xrefTargets.map((t) => (
            <option key={t.id} value={`${t.targetType}:${t.id}`}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <EditorContent
        editor={editor}
        className="px-3 py-2 text-sm leading-relaxed text-gray-900 dark:text-gray-100 [&_.ProseMirror]:outline-none"
      />
    </div>
  );
}
