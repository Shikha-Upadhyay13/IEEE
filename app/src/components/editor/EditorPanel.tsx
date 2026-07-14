import { useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDocumentStore } from "../../store/documentStore";
import type { BodyNode } from "../../types/document";
import { RichParagraphEditor } from "./richtext/RichParagraphEditor";
import { FigureEditor } from "./FigureEditor";
import { TableEditor } from "./TableEditor";
import { btnDanger, btnSecondary, cardBase, inputBase, labelBase } from "../../lib/uiClasses";

// Two problems compound here, both from nested sortable items having
// wildly different heights (a section's rect spans all its nested content):
// (1) closestCenter's default global comparison can resolve to a nested
//     descendant instead of the top-level section being hovered over —
//     fixed by restricting candidates to the active item's own container
//     (matched via the containerId each item is tagged with).
// (2) Even within one container, comparing raw rect *centers* is unreliable
//     when items have very different heights — a tall item's center can
//     end up closer to the pointer than the item actually under the cursor.
//     Fixed by preferring pointerWithin (is the pointer literally inside this
//     rect?) and only falling back to closestCenter if the pointer isn't
//     within any candidate (e.g. a fast drag momentarily outside every rect).
const collisionDetectionWithinContainer: CollisionDetection = (args) => {
  const activeContainerId = args.active.data.current?.containerId ?? null;
  const sameContainer = args.droppableContainers.filter(
    (container) => (container.data.current?.containerId ?? null) === activeContainerId
  );
  const filteredArgs = { ...args, droppableContainers: sameContainer };
  const pointerCollisions = pointerWithin(filteredArgs);
  return pointerCollisions.length > 0 ? pointerCollisions : closestCenter(filteredArgs);
};

// `containerId` is the id of the sibling list this node lives in (null for the
// document's top-level body, or the parent section's id) — dnd-kit needs this
// on each draggable so reorderBlocks knows which list to reorder within, and
// so a drag can't (yet) reorder across two different containers.
function SortableBlockItem({
  node,
  containerId,
  depth,
}: {
  node: BodyNode;
  containerId: string | null;
  depth: number;
}) {
  const updateParagraphContent = useDocumentStore((s) => s.updateParagraphContent);
  const updateSectionHeading = useDocumentStore((s) => s.updateSectionHeading);
  const removeBlock = useDocumentStore((s) => s.removeBlock);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.id,
    data: { containerId },
  });

  const wrapperStyle = { transform: CSS.Transform.toString(transform), transition };
  const wrapperClass = `${isDragging ? "opacity-50" : ""} mb-2`;

  const dragHandle = (
    <button
      {...attributes}
      {...listeners}
      data-drag-handle={node.id}
      aria-label="Drag to reorder"
      className="flex-none w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-gray-500 hover:bg-gray-100 cursor-grab active:cursor-grabbing touch-none"
    >
      ⠿
    </button>
  );

  const deleteButton = (
    <button onClick={() => removeBlock(node.id)} className={btnDanger} aria-label="Delete block">
      Delete
    </button>
  );

  if (node.type === "section") {
    return (
      <div
        ref={setNodeRef}
        data-block-id={node.id}
        style={{ ...wrapperStyle, marginLeft: depth * 16 }}
        className={`${wrapperClass} ${cardBase} p-3`}
      >
        <div className="flex gap-2 items-center mb-2">
          {dragHandle}
          <input
            value={node.heading}
            onChange={(e) => updateSectionHeading(node.id, e.target.value)}
            className={`${inputBase} font-semibold`}
          />
          {deleteButton}
        </div>
        {node.children.length === 0 ? (
          <p className="text-xs text-gray-400 pl-8">Empty section</p>
        ) : (
          <div className="pl-6 border-l-2 border-gray-100">
            <SortableBlockList containerId={node.id} nodes={node.children} depth={depth + 1} />
          </div>
        )}
      </div>
    );
  }

  if (node.type === "paragraph") {
    return (
      <div
        ref={setNodeRef}
        data-block-id={node.id}
        style={{ ...wrapperStyle, marginLeft: depth * 16 }}
        className={wrapperClass}
      >
        <div className="flex gap-2 items-start">
          {dragHandle}
          <div className="flex-1 min-w-0">
            <RichParagraphEditor
              content={node.content}
              onChange={(content) => updateParagraphContent(node.id, content)}
            />
          </div>
          {deleteButton}
        </div>
      </div>
    );
  }

  if (node.type === "figure") {
    return (
      <div
        ref={setNodeRef}
        data-block-id={node.id}
        style={{ ...wrapperStyle, marginLeft: depth * 16 }}
        className={`${wrapperClass} ${cardBase} p-3`}
      >
        <div className="flex gap-2 items-start">
          {dragHandle}
          <div className="flex-1 min-w-0">
            <FigureEditor node={node} />
          </div>
          {deleteButton}
        </div>
      </div>
    );
  }

  if (node.type === "table") {
    return (
      <div
        ref={setNodeRef}
        data-block-id={node.id}
        style={{ ...wrapperStyle, marginLeft: depth * 16 }}
        className={`${wrapperClass} ${cardBase} p-3`}
      >
        <div className="flex gap-2 items-start">
          {dragHandle}
          <div className="flex-1 min-w-0">
            <TableEditor node={node} />
          </div>
          {deleteButton}
        </div>
      </div>
    );
  }

  // equation: not yet editable in this milestone — can be reordered/removed.
  return (
    <div
      ref={setNodeRef}
      data-block-id={node.id}
      style={{ ...wrapperStyle, marginLeft: depth * 16 }}
      className={`${wrapperClass} flex gap-2 items-center ${cardBase} px-3 py-2`}
    >
      {dragHandle}
      <span className="text-xs text-gray-500 font-mono">
        [{node.type}] {node.id}
      </span>
      {deleteButton}
    </div>
  );
}

function SortableBlockList({
  containerId,
  nodes,
  depth,
}: {
  containerId: string | null;
  nodes: BodyNode[];
  depth: number;
}) {
  return (
    <SortableContext items={nodes.map((n) => n.id)} strategy={verticalListSortingStrategy}>
      {nodes.map((node) => (
        <SortableBlockItem key={node.id} node={node} containerId={containerId} depth={depth} />
      ))}
    </SortableContext>
  );
}

// Keeps its own draft text as the source of truth for what's displayed,
// separate from the store's normalized (split + trimmed + empties-dropped)
// keyword array — binding the input directly to the normalized array would
// snap back and eat a trailing ", " while the user is still typing the next
// keyword. The store is still updated on every keystroke; only the input's
// *display* value is decoupled from that normalization.
function KeywordsInput({
  keywords,
  onChange,
}: {
  keywords: string[];
  onChange: (commaSeparated: string) => void;
}) {
  const [draft, setDraft] = useState(keywords.join(", "));

  return (
    <div className="mb-4">
      <label htmlFor="paper-keywords" className={labelBase}>
        Keywords (comma-separated)
      </label>
      <input
        id="paper-keywords"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          onChange(e.target.value);
        }}
        className={inputBase}
      />
    </div>
  );
}

export function EditorPanel() {
  const document = useDocumentStore((s) => s.document);
  const setTitle = useDocumentStore((s) => s.setTitle);
  const setAbstract = useDocumentStore((s) => s.setAbstract);
  const setKeywords = useDocumentStore((s) => s.setKeywords);
  const appendParagraph = useDocumentStore((s) => s.appendParagraph);
  const appendSection = useDocumentStore((s) => s.appendSection);
  const appendFigure = useDocumentStore((s) => s.appendFigure);
  const appendTable = useDocumentStore((s) => s.appendTable);
  const reorderBlocks = useDocumentStore((s) => s.reorderBlocks);

  const sensors = useSensors(
    // A small activation distance keeps ordinary clicks (into a text field,
    // onto the delete button) from being misread as a drag start.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeContainer = (active.data.current?.containerId ?? null) as string | null;
    const overContainer = (over.data.current?.containerId ?? null) as string | null;
    // Reordering across two different containers (e.g. dragging a paragraph
    // into a different section) isn't supported yet — only same-list reorder.
    if (activeContainer !== overContainer) return;
    reorderBlocks(activeContainer, String(active.id), String(over.id));
  }

  const titleText = document.titleBlock.title
    .map((n) => (n.type === "text" ? n.text : ""))
    .join("");

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
      <div className="mb-4">
        <label htmlFor="paper-title" className={labelBase}>
          Title
        </label>
        <textarea
          id="paper-title"
          value={titleText}
          onChange={(e) => setTitle(e.target.value)}
          rows={2}
          className={`${inputBase} resize-none`}
        />
      </div>

      <div className="mb-4">
        <label htmlFor="paper-abstract" className={labelBase}>
          Abstract
        </label>
        <textarea
          id="paper-abstract"
          value={document.abstract.text}
          onChange={(e) => setAbstract(e.target.value)}
          rows={4}
          className={`${inputBase} resize-none`}
        />
      </div>

      <KeywordsInput keywords={document.keywords} onChange={setKeywords} />

      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2 mt-6">
        Body
      </h3>
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetectionWithinContainer}
        onDragEnd={handleDragEnd}
      >
        <SortableBlockList containerId={null} nodes={document.body} depth={0} />
      </DndContext>

      <div className="flex gap-2 flex-wrap mt-3">
        <button onClick={appendParagraph} className={btnSecondary}>
          + Paragraph
        </button>
        <button onClick={appendSection} className={btnSecondary}>
          + Section
        </button>
        <button onClick={appendFigure} className={btnSecondary}>
          + Figure
        </button>
        <button onClick={appendTable} className={btnSecondary}>
          + Table
        </button>
      </div>
    </div>
  );
}
