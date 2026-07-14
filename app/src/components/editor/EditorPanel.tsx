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

  const wrapperStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    marginLeft: depth * 16,
    marginBottom: 8,
  };

  const dragHandle = (
    <button
      {...attributes}
      {...listeners}
      data-drag-handle={node.id}
      style={{ cursor: "grab", touchAction: "none" }}
      aria-label="Drag to reorder"
    >
      ⠿
    </button>
  );

  if (node.type === "section") {
    return (
      <div
        ref={setNodeRef}
        data-block-id={node.id}
        style={{ ...wrapperStyle, border: "1px solid #ccc", padding: 8 }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          {dragHandle}
          <input
            value={node.heading}
            onChange={(e) => updateSectionHeading(node.id, e.target.value)}
            style={{ flex: 1, fontWeight: "bold" }}
          />
          <button onClick={() => removeBlock(node.id)}>Delete</button>
        </div>
        {node.children.length === 0 ? (
          <p style={{ color: "#888", fontSize: 12 }}>(empty section)</p>
        ) : (
          <SortableBlockList containerId={node.id} nodes={node.children} depth={depth + 1} />
        )}
      </div>
    );
  }

  if (node.type === "paragraph") {
    return (
      <div ref={setNodeRef} data-block-id={node.id} style={wrapperStyle}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          {dragHandle}
          <div style={{ flex: 1 }}>
            <RichParagraphEditor
              content={node.content}
              onChange={(content) => updateParagraphContent(node.id, content)}
            />
          </div>
          <button onClick={() => removeBlock(node.id)}>Delete</button>
        </div>
      </div>
    );
  }

  if (node.type === "figure") {
    return (
      <div ref={setNodeRef} data-block-id={node.id} style={wrapperStyle}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          {dragHandle}
          <div style={{ flex: 1 }}>
            <FigureEditor node={node} />
          </div>
          <button onClick={() => removeBlock(node.id)}>Delete</button>
        </div>
      </div>
    );
  }

  if (node.type === "table") {
    return (
      <div ref={setNodeRef} data-block-id={node.id} style={wrapperStyle}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          {dragHandle}
          <div style={{ flex: 1 }}>
            <TableEditor node={node} />
          </div>
          <button onClick={() => removeBlock(node.id)}>Delete</button>
        </div>
      </div>
    );
  }

  // equation: not yet editable in this milestone — can be reordered/removed.
  return (
    <div
      ref={setNodeRef}
      data-block-id={node.id}
      style={{ ...wrapperStyle, display: "flex", gap: 8, alignItems: "center" }}
    >
      {dragHandle}
      <span style={{ fontSize: 12, color: "#555" }}>
        [{node.type}] {node.id}
      </span>
      <button onClick={() => removeBlock(node.id)}>Delete</button>
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
    <>
      <label htmlFor="paper-keywords">Keywords (comma-separated)</label>
      <input
        id="paper-keywords"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          onChange(e.target.value);
        }}
        style={{ width: "100%", marginBottom: 12, boxSizing: "border-box" }}
      />
    </>
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
    <div
      style={{
        width: 380,
        padding: 16,
        overflowY: "auto",
        flex: 1,
        minHeight: 0,
        boxSizing: "border-box",
        fontFamily: "sans-serif",
        fontSize: 14,
      }}
    >
      <h2>Editor</h2>

      <label htmlFor="paper-title">Title</label>
      <textarea
        id="paper-title"
        value={titleText}
        onChange={(e) => setTitle(e.target.value)}
        rows={2}
        style={{ width: "100%", marginBottom: 12, boxSizing: "border-box" }}
      />

      <label htmlFor="paper-abstract">Abstract</label>
      <textarea
        id="paper-abstract"
        value={document.abstract.text}
        onChange={(e) => setAbstract(e.target.value)}
        rows={4}
        style={{ width: "100%", marginBottom: 12, boxSizing: "border-box" }}
      />

      <KeywordsInput keywords={document.keywords} onChange={setKeywords} />

      <h3>Body</h3>
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetectionWithinContainer}
        onDragEnd={handleDragEnd}
      >
        <SortableBlockList containerId={null} nodes={document.body} depth={0} />
      </DndContext>

      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <button onClick={appendParagraph}>+ Paragraph</button>
        <button onClick={appendSection}>+ Section</button>
        <button onClick={appendFigure}>+ Figure</button>
        <button onClick={appendTable}>+ Table</button>
      </div>
    </div>
  );
}
