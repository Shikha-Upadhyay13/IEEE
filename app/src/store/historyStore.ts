import { create } from "zustand";
import type { Document } from "../types/document";
import { useDocumentStore } from "./documentStore";

const HISTORY_LIMIT = 100;
// Changes closer together than this (e.g. a burst of typing) undo as one step.
export const COALESCE_MS = 800;

type HistoryState = { past: Document[]; future: Document[] };

export const useHistoryStore = create<HistoryState>(() => ({ past: [], future: [] }));

let applying = false;
let lastChangeAt = 0;

export function resetHistory() {
  lastChangeAt = 0;
  useHistoryStore.setState({ past: [], future: [] });
}

useDocumentStore.subscribe((state, prev) => {
  if (state.document === prev.document) return;
  if (state.documentId !== prev.documentId) {
    resetHistory();
    return;
  }
  if (applying) return;
  const now = Date.now();
  const { past } = useHistoryStore.getState();
  if (past.length === 0 || now - lastChangeAt > COALESCE_MS) {
    useHistoryStore.setState({ past: [...past, prev.document].slice(-HISTORY_LIMIT), future: [] });
  } else {
    useHistoryStore.setState({ future: [] });
  }
  lastChangeAt = now;
});

function apply(document: Document) {
  applying = true;
  try {
    useDocumentStore.setState({ document });
  } finally {
    applying = false;
  }
  // The next edit after an undo/redo always starts a fresh step.
  lastChangeAt = 0;
}

export function undo() {
  const { past, future } = useHistoryStore.getState();
  const previous = past[past.length - 1];
  if (!previous) return;
  const current = useDocumentStore.getState().document;
  useHistoryStore.setState({ past: past.slice(0, -1), future: [current, ...future] });
  apply(previous);
}

export function redo() {
  const { past, future } = useHistoryStore.getState();
  const next = future[0];
  if (!next) return;
  const current = useDocumentStore.getState().document;
  useHistoryStore.setState({ past: [...past, current], future: future.slice(1) });
  apply(next);
}
