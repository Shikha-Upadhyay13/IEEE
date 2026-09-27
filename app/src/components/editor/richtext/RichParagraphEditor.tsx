import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { Image as ImageIcon, Link2, Quote, Sparkles, Table2 } from "lucide-react";
import { ParagraphAiPanel } from "./ParagraphAiPanel";
import { PARAGRAPH_AI_ACTIONS, type ParagraphAiAction } from "../../../lib/paragraphAiActions";
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
  const [aiAction, setAiAction] = useState<ParagraphAiAction | null>(null);
  const hasText = content.some((n) => n.type === "text" && n.text.trim() !== "");
  const paperTitle = document.titleBlock.title.map((n) => (n.type === "text" ? n.text : "")).join("");
  const aiContext = `Paper title: ${paperTitle}\nAbstract: ${document.abstract.text || "(not written yet)"}`;
  const labelFor = (node: InlineNode) =>
    node.type === "citeRef"
      ? `[${citationNumberFor(document, node.refId) ?? "?"}]`
      : node.type === "xref"
        ? (xrefLabelFor(document, node.targetType, node.targetId) ?? node.targetType)
        : "";
  const citationItems: MenuItem[] = references
    .map((ref) => {
      const n = citationNumberFor(document, ref.id);
      const { label, description } = referenceLabel(ref);
      return { id: ref.id, n: n ?? 0, label: `[${n ?? "?"}] ${label}`, description };
    })
    .sort((a, b) => a.n - b.n)
    .map(({ id, label, description }) => ({ id, label, description, onSelect: () => insertCitation(id) }));
  const xrefTargets = collectXrefTargets(document.body);
  const xrefItem = (t: (typeof xrefTargets)[number]): MenuItem => ({
    id: `${t.targetType}:${t.id}`,
    label: xrefLabelFor(document, t.targetType, t.id) ?? t.targetType,
    description: truncate(t.label, 50),
    icon: t.targetType === "figure" ? ImageIcon : Table2,
    onSelect: () => insertXref(`${t.targetType}:${t.id}`),
  });
  const xrefGroups = [
    { label: "Figures", items: xrefTargets.filter((t) => t.targetType === "figure").map(xrefItem) },
    { label: "Tables", items: xrefTargets.filter((t) => t.targetType === "table").map(xrefItem) },
  ].filter((g) => g.items.length > 0);

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
    // `content` only seeds the editor once (useEditor's default deps are []);
    // external changes such as undo/redo are synced by the effect below.
    content: inlineNodesToTipTapDoc(content),
    onUpdate: ({ editor }) => onChange(tipTapDocToInlineNodes(editor.getJSON())),
    onFocus: () => {
      hasBeenFocused.current = true;
    },
  });

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const current = JSON.stringify(tipTapDocToInlineNodes(editor.getJSON()));
    if (current !== JSON.stringify(content)) {
      editor.commands.setContent(inlineNodesToTipTapDoc(content), { emitUpdate: false });
    }
  }, [editor, content]);

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
        : "text-muted hover:bg-canvas"
    }`;
  const toolbarMenuBtn =
    "h-7 inline-flex items-center gap-1 rounded px-2 text-xs font-medium text-muted hover:bg-canvas aria-expanded:bg-accent-soft aria-expanded:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent";
  return (
    <div
      data-rich-paragraph-editor=""
      className="rounded-md border border-line bg-surface focus-within:border-accent focus-within:ring-1 focus-within:ring-accent"
    >
      <div className="flex gap-1 flex-wrap items-center px-2 py-1.5 border-b border-line">
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
        <div className="w-px h-4 bg-line mx-1" />
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
        <Menu
          trigger={
            <>
              <Link2 size={13} aria-hidden="true" />
              Cross-ref
            </>
          }
          title="Insert a cross-reference to a figure or table at the cursor"
          triggerClassName={toolbarMenuBtn}
          width={300}
          groups={xrefGroups}
          emptyMessage="No figures or tables yet — add one with Add block."
        />
        <span className="flex-1" />
        <Menu
          trigger={
            <>
              <Sparkles size={13} aria-hidden="true" />
              AI
            </>
          }
          title={hasText ? "Improve this paragraph with AI" : "Write something first"}
          disabled={!hasText}
          align="end"
          triggerClassName={toolbarMenuBtn}
          width={260}
          groups={[
            {
              items: PARAGRAPH_AI_ACTIONS.map((a) => ({
                id: a.id,
                label: a.label,
                description: a.description,
                onSelect: () => setAiAction(a.id),
              })),
            },
          ]}
        />
      </div>
      <EditorContent
        editor={editor}
        className="px-3 py-2 text-sm leading-relaxed text-ink [&_.ProseMirror]:outline-none"
      />
      {aiAction && (
        <ParagraphAiPanel
          key={aiAction}
          action={aiAction}
          content={content}
          context={aiContext}
          labelFor={labelFor}
          onAccept={(next) => {
            onChange(next);
            setAiAction(null);
          }}
          onClose={() => setAiAction(null)}
        />
      )}
    </div>
  );
}
