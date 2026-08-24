import { create } from "zustand";
import type { Document, BodyNode, InlineNode, TableSpacing, FigureImage, FigureAlign, FontFamily } from "../types/document";
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

// Finds `id` anywhere in the tree, removes it, and hands it back so the
// caller can re-insert it elsewhere — the "move" half of moveBlockToSection.
// Unlike removeNodeById, this needs the removed node itself, not just the
// tree without it.
function extractNodeById(
  nodes: BodyNode[],
  id: string
): { remaining: BodyNode[]; extracted: BodyNode | null } {
  let extracted: BodyNode | null = null;
  const remaining: BodyNode[] = [];
  for (const node of nodes) {
    if (node.id === id) {
      extracted = node;
      continue;
    }
    if (!extracted && node.type === "section") {
      const result = extractNodeById(node.children, id);
      if (result.extracted) {
        extracted = result.extracted;
        remaining.push({ ...node, children: result.remaining });
        continue;
      }
    }
    remaining.push(node);
  }
  return { remaining, extracted };
}

// Every id nested anywhere inside a section — moving that section into one
// of its own descendants would orphan it (the section would contain itself),
// so callers use this to filter those out as invalid drop targets.
export function collectSectionDescendantIds(node: BodyNode): Set<string> {
  const ids = new Set<string>();
  if (node.type !== "section") return ids;
  function walk(children: BodyNode[]) {
    for (const child of children) {
      ids.add(child.id);
      if (child.type === "section") walk(child.children);
    }
  }
  walk(node.children);
  return ids;
}

// Flat, indented list of every section in the document — powers the "Move
// to…" dropdown's options (plain paragraphs/figures/tables/equations can't
// contain other blocks, so they're never valid move targets).
export function collectSectionOptions(nodes: BodyNode[], depth = 0): { id: string; label: string }[] {
  const options: { id: string; label: string }[] = [];
  for (const node of nodes) {
    if (node.type !== "section") continue;
    options.push({ id: node.id, label: `${"— ".repeat(depth)}${node.heading || "Untitled section"}` });
    options.push(...collectSectionOptions(node.children, depth + 1));
  }
  return options;
}

// Shared by the top-level append* actions and appendBlockToSection below —
// one definition of "what a fresh block of type X looks like" rather than
// two copies that could drift out of sync.
function createBlock(type: BodyNode["type"]): BodyNode {
  switch (type) {
    case "paragraph":
      return { type: "paragraph", id: generateId("p"), content: [] };
    case "section":
      return { type: "section", id: generateId("sec"), heading: "New Section", level: 1, children: [] };
    case "figure":
      return {
        type: "figure",
        id: generateId("fig"),
        width: "single-column",
        images: [],
        scale: 100,
        align: "center",
        caption: [{ type: "text", text: "New figure — upload an image and add a caption." }],
      };
    case "table":
      return {
        type: "table",
        id: generateId("tbl"),
        width: "single-column",
        caption: [{ type: "text", text: "New table" }],
        rows: [
          ["", ""],
          ["", ""],
        ],
        spacing: "comfortable",
      };
    case "equation":
      return { type: "equation", id: generateId("eq"), latex: "" };
  }
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
  setFontFamily: (fontFamily: FontFamily) => void;
  appendParagraph: () => void;
  appendSection: () => void;
  appendFigure: () => void;
  appendTable: () => void;
  appendEquation: () => void;
  appendBlockToSection: (sectionId: string, type: BodyNode["type"]) => void;
  moveBlockToSection: (blockId: string, targetSectionId: string | null) => void;
  updateParagraphContent: (id: string, content: InlineNode[]) => void;
  updateSectionHeading: (id: string, heading: string) => void;
  addFigureImage: (id: string, image: FigureImage) => void;
  removeFigureImageAt: (id: string, index: number) => void;
  updateFigureCaption: (id: string, caption: InlineNode[]) => void;
  updateFigureWidth: (id: string, width: BlockWidth) => void;
  updateFigureScale: (id: string, scale: number) => void;
  updateFigureAlign: (id: string, align: FigureAlign) => void;
  updateTableCaption: (id: string, caption: InlineNode[]) => void;
  updateTableRows: (id: string, rows: string[][]) => void;
  updateTableWidth: (id: string, width: BlockWidth) => void;
  updateTableSpacing: (id: string, spacing: TableSpacing) => void;
  updateEquationLatex: (id: string, latex: string) => void;
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

  setFontFamily: (fontFamily) =>
    set((state) => ({ document: { ...state.document, meta: { ...state.document.meta, fontFamily } } })),

  appendParagraph: () =>
    set((state) => ({ document: { ...state.document, body: [...state.document.body, createBlock("paragraph")] } })),

  appendSection: () =>
    set((state) => ({ document: { ...state.document, body: [...state.document.body, createBlock("section")] } })),

  appendFigure: () =>
    set((state) => ({ document: { ...state.document, body: [...state.document.body, createBlock("figure")] } })),

  appendTable: () =>
    set((state) => ({ document: { ...state.document, body: [...state.document.body, createBlock("table")] } })),

  appendEquation: () =>
    set((state) => ({ document: { ...state.document, body: [...state.document.body, createBlock("equation")] } })),

  // The top-level append* actions above only ever push onto the document's
  // root body — there was previously no way to put a block *inside* a
  // section at all (drag-and-drop only reorders within one existing list).
  // A section that starts empty (every new one does) was a dead end without this.
  appendBlockToSection: (sectionId, type) =>
    set((state) => ({
      document: {
        ...state.document,
        body: updateNodeById(state.document.body, sectionId, (node) =>
          node.type === "section" ? { ...node, children: [...node.children, createBlock(type)] } : node
        ),
      },
    })),

  // Explicit "Move to…" control rather than pixel-level cross-container
  // drag: the existing dnd-kit setup only ever reordered within one already-
  // visible list, and extending it to drop *into* a (possibly collapsed)
  // section reliably is a much harder interaction to get right blind.
  moveBlockToSection: (blockId, targetSectionId) =>
    set((state) => {
      if (blockId === targetSectionId) return {};
      const { remaining, extracted } = extractNodeById(state.document.body, blockId);
      if (!extracted) return {};
      if (targetSectionId && extracted.type === "section") {
        if (collectSectionDescendantIds(extracted).has(targetSectionId)) return {};
      }
      if (targetSectionId === null) {
        return { document: { ...state.document, body: [...remaining, extracted] } };
      }
      return {
        document: {
          ...state.document,
          body: updateNodeById(remaining, targetSectionId, (node) =>
            node.type === "section" ? { ...node, children: [...node.children, extracted] } : node
          ),
        },
      };
    }),

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

  addFigureImage: (id, image) =>
    set((state) => ({
      document: {
        ...state.document,
        body: updateNodeById(state.document.body, id, (node) =>
          node.type === "figure" ? { ...node, images: [...(node.images ?? []), image] } : node
        ),
      },
    })),

  removeFigureImageAt: (id, index) =>
    set((state) => ({
      document: {
        ...state.document,
        body: updateNodeById(state.document.body, id, (node) =>
          node.type === "figure"
            ? { ...node, images: (node.images ?? []).filter((_, i) => i !== index) }
            : node
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

  updateFigureScale: (id, scale) =>
    set((state) => ({
      document: {
        ...state.document,
        body: updateNodeById(state.document.body, id, (node) =>
          node.type === "figure" ? { ...node, scale } : node
        ),
      },
    })),

  updateFigureAlign: (id, align) =>
    set((state) => ({
      document: {
        ...state.document,
        body: updateNodeById(state.document.body, id, (node) =>
          node.type === "figure" ? { ...node, align } : node
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

  updateTableSpacing: (id, spacing) =>
    set((state) => ({
      document: {
        ...state.document,
        body: updateNodeById(state.document.body, id, (node) =>
          node.type === "table" ? { ...node, spacing } : node
        ),
      },
    })),

  updateEquationLatex: (id, latex) =>
    set((state) => ({
      document: {
        ...state.document,
        body: updateNodeById(state.document.body, id, (node) =>
          node.type === "equation" ? { ...node, latex } : node
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
