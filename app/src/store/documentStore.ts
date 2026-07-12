import { create } from "zustand";
import type { Document, BodyNode } from "../types/document";
import { samplePaper } from "../data/samplePaper";

function generateId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

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

type DocumentStore = {
  document: Document;
  setTitle: (text: string) => void;
  setAbstract: (text: string) => void;
  setKeywords: (commaSeparated: string) => void;
  appendParagraph: () => void;
  appendSection: () => void;
  updateParagraphText: (id: string, text: string) => void;
  updateSectionHeading: (id: string, heading: string) => void;
  removeBlock: (id: string) => void;
};

export const useDocumentStore = create<DocumentStore>((set) => ({
  document: samplePaper,

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

  // NOTE: replaces the paragraph's content with a single plain-text run — any
  // citeRef/xref nodes it contained are lost. Rich, citation-aware editing
  // arrives in Milestone 4 (TipTap); this is the accepted plain-textarea
  // editing model for Milestone 2, not a regression.
  updateParagraphText: (id, text) =>
    set((state) => ({
      document: {
        ...state.document,
        body: updateNodeById(state.document.body, id, (node) =>
          node.type === "paragraph" ? { ...node, content: [{ type: "text", text }] } : node
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

  removeBlock: (id) =>
    set((state) => ({ document: { ...state.document, body: removeNodeById(state.document.body, id) } })),
}));
