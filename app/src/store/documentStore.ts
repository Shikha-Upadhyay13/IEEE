import { create } from "zustand";
import type { Document, BodyNode, InlineNode } from "../types/document";
import { samplePaper } from "../data/samplePaper";
import { generateId } from "../lib/id";
import { emptyReferenceFields, generateReferenceText, type ReferenceFields } from "../lib/generateReferenceText";

type BlockWidth = Extract<BodyNode, { type: "figure" }>["width"];

// Recursively find `id` among a section's children too, not just its direct siblings.
function updateNodeById(
  nodes: BodyNode[],
  id: string,
  updater: (node: BodyNode) => BodyNode
): BodyNode[] {
  return nodes.map((node) => {
    if (node.id === id) return updater(node);
    if (node.type === "section") {
      return { ...node, children: updateNodeById(node.children, id, updater) };
    }
    return node;
  });
}

function removeNodeById(nodes: BodyNode[], id: string): BodyNode[] {
  return nodes
    .filter((node) => node.id !== id)
    .map((node) =>
      node.type === "section" ? { ...node, children: removeNodeById(node.children, id) } : node
    );
}

function arrayMove<T>(arr: T[], fromIndex: number, toIndex: number): T[] {
  const copy = arr.slice();
  const [item] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, item);
  return copy;
}

// `containerId` identifies the sibling list being reordered: null for the
// document's top-level body, or a section's id for reordering within its
// children. Only reorders within the same list — dragging a block into a
// *different* section is a future enhancement, not this milestone's scope.
function reorderWithin(
  nodes: BodyNode[],
  containerId: string | null,
  activeId: string,
  overId: string
): BodyNode[] {
  if (containerId === null) {
    const activeIndex = nodes.findIndex((n) => n.id === activeId);
    const overIndex = nodes.findIndex((n) => n.id === overId);
    if (activeIndex === -1 || overIndex === -1) return nodes;
    return arrayMove(nodes, activeIndex, overIndex);
  }
  return nodes.map((node) => {
    if (node.type !== "section") return node;
    if (node.id === containerId) {
      const activeIndex = node.children.findIndex((n) => n.id === activeId);
      const overIndex = node.children.findIndex((n) => n.id === overId);
      if (activeIndex === -1 || overIndex === -1) return node;
      return { ...node, children: arrayMove(node.children, activeIndex, overIndex) };
    }
    return { ...node, children: reorderWithin(node.children, containerId, activeId, overId) };
  });
}

type DocumentStore = {
  document: Document;
  // Which persisted row `document` corresponds to, or null before a real
  // document has been loaded (e.g. the transient initial/default state).
  documentId: string | null;
  loadDocument: (id: string, doc: Document) => void;
  setTitle: (text: string) => void;
  setAbstract: (text: string) => void;
  setKeywords: (commaSeparated: string) => void;
  appendParagraph: () => void;
  appendSection: () => void;
  appendFigure: () => void;
  appendTable: () => void;
  updateParagraphContent: (id: string, content: InlineNode[]) => void;
  updateSectionHeading: (id: string, heading: string) => void;
  updateFigureImage: (id: string, image: { url: string; alt: string }) => void;
  updateFigureCaption: (id: string, caption: InlineNode[]) => void;
  updateFigureWidth: (id: string, width: BlockWidth) => void;
  updateTableCaption: (id: string, caption: InlineNode[]) => void;
  updateTableRows: (id: string, rows: string[][]) => void;
  updateTableWidth: (id: string, width: BlockWidth) => void;
  removeBlock: (id: string) => void;
  reorderBlocks: (containerId: string | null, activeId: string, overId: string) => void;
  addReference: () => void;
  updateReferenceField: (id: string, field: keyof ReferenceFields, value: string) => void;
  removeReference: (id: string) => void;
};

export const useDocumentStore = create<DocumentStore>((set) => ({
  // Transient placeholder shown only while the Editor route's load-on-mount
  // is in flight — real usage always calls loadDocument before a user edits.
  document: samplePaper,
  documentId: null,

  loadDocument: (id, doc) => set({ documentId: id, document: doc }),

  setTitle: (text) =>
    set((state) => ({
      document: {
        ...state.document,
        titleBlock: { ...state.document.titleBlock, title: [{ type: "text", text }] },
      },
    })),

  setAbstract: (text) =>
    set((state) => ({ document: { ...state.document, abstract: { text } } })),

  setKeywords: (commaSeparated) =>
    set((state) => ({
      document: {
        ...state.document,
        keywords: commaSeparated
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
      },
    })),

  appendParagraph: () =>
    set((state) => ({
      document: {
        ...state.document,
        body: [
          ...state.document.body,
          {
            type: "paragraph",
            id: generateId("p"),
            content: [{ type: "text", text: "New paragraph — click to edit." }],
          },
        ],
      },
    })),

  appendSection: () =>
    set((state) => ({
      document: {
        ...state.document,
        body: [
          ...state.document.body,
          { type: "section", id: generateId("sec"), heading: "New Section", level: 1, children: [] },
        ],
      },
    })),

  appendFigure: () =>
    set((state) => ({
      document: {
        ...state.document,
        body: [
          ...state.document.body,
          {
            type: "figure",
            id: generateId("fig"),
            width: "single-column",
            image: { url: "", alt: "" },
            caption: [{ type: "text", text: "New figure — upload an image and add a caption." }],
          },
        ],
      },
    })),

  appendTable: () =>
    set((state) => ({
      document: {
        ...state.document,
        body: [
          ...state.document.body,
          {
            type: "table",
            id: generateId("tbl"),
            width: "single-column",
            caption: [{ type: "text", text: "New table" }],
            rows: [
              ["", ""],
              ["", ""],
            ],
          },
        ],
      },
    })),

  // Full inline-content replacement, preserving any citeRef/xref nodes the
  // rich-text editor (TipTap) round-trips — unlike Milestone 2's plain-text
  // textarea, this no longer destroys citations on edit.
  updateParagraphContent: (id, content) =>
    set((state) => ({
      document: {
        ...state.document,
        body: updateNodeById(state.document.body, id, (node) =>
          node.type === "paragraph" ? { ...node, content } : node
        ),
      },
    })),

  updateSectionHeading: (id, heading) =>
    set((state) => ({
      document: {
        ...state.document,
        body: updateNodeById(state.document.body, id, (node) =>
          node.type === "section" ? { ...node, heading } : node
        ),
      },
    })),

  updateFigureImage: (id, image) =>
    set((state) => ({
      document: {
        ...state.document,
        body: updateNodeById(state.document.body, id, (node) =>
          node.type === "figure" ? { ...node, image } : node
        ),
      },
    })),

  updateFigureCaption: (id, caption) =>
    set((state) => ({
      document: {
        ...state.document,
        body: updateNodeById(state.document.body, id, (node) =>
          node.type === "figure" ? { ...node, caption } : node
        ),
      },
    })),

  updateFigureWidth: (id, width) =>
    set((state) => ({
      document: {
        ...state.document,
        body: updateNodeById(state.document.body, id, (node) =>
          node.type === "figure" ? { ...node, width } : node
        ),
      },
    })),

  updateTableCaption: (id, caption) =>
    set((state) => ({
      document: {
        ...state.document,
        body: updateNodeById(state.document.body, id, (node) =>
          node.type === "table" ? { ...node, caption } : node
        ),
      },
    })),

  updateTableRows: (id, rows) =>
    set((state) => ({
      document: {
        ...state.document,
        body: updateNodeById(state.document.body, id, (node) =>
          node.type === "table" ? { ...node, rows } : node
        ),
      },
    })),

  updateTableWidth: (id, width) =>
    set((state) => ({
      document: {
        ...state.document,
        body: updateNodeById(state.document.body, id, (node) =>
          node.type === "table" ? { ...node, width } : node
        ),
      },
    })),

  removeBlock: (id) =>
    set((state) => ({ document: { ...state.document, body: removeNodeById(state.document.body, id) } })),

  reorderBlocks: (containerId, activeId, overId) =>
    set((state) => ({
      document: {
        ...state.document,
        body: reorderWithin(state.document.body, containerId, activeId, overId),
      },
    })),

  addReference: () =>
    set((state) => ({
      document: {
        ...state.document,
        references: [
          ...state.document.references,
          { id: generateId("ref"), fields: { ...emptyReferenceFields }, renderedText: "" },
        ],
      },
    })),

  // Regenerates renderedText from the full field set on every change, so the
  // displayed citation always matches what's actually in the form — never a
  // stale string the user could otherwise end up hand-editing out of sync.
  updateReferenceField: (id, field, value) =>
    set((state) => ({
      document: {
        ...state.document,
        references: state.document.references.map((ref) => {
          if (ref.id !== id) return ref;
          const fields = { ...(ref.fields as ReferenceFields), [field]: value };
          return { ...ref, fields, renderedText: generateReferenceText(fields) };
        }),
      },
    })),

  removeReference: (id) =>
    set((state) => ({
      document: {
        ...state.document,
        references: state.document.references.filter((ref) => ref.id !== id),
      },
    })),
}));
