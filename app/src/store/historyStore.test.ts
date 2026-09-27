import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useDocumentStore } from "./documentStore";
import { COALESCE_MS, redo, undo, useHistoryStore } from "./historyStore";
import { createBlankDocument } from "../lib/blankDocument";

function title() {
  const node = useDocumentStore.getState().document.titleBlock.title[0];
  return node?.type === "text" ? node.text : "";
}

describe("undo/redo history", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useDocumentStore.getState().loadDocument(`doc-${Math.random()}`, createBlankDocument());
  });
  afterEach(() => vi.useRealTimers());

  it("undoes and redoes a change", () => {
    useDocumentStore.getState().setTitle("First");
    vi.advanceTimersByTime(COALESCE_MS + 1);
    useDocumentStore.getState().setTitle("Second");
    undo();
    expect(title()).toBe("First");
    undo();
    expect(title()).toBe("Untitled Paper");
    redo();
    redo();
    expect(title()).toBe("Second");
  });

  it("groups a quick burst of edits into one step", () => {
    const s = useDocumentStore.getState();
    s.setTitle("A");
    vi.advanceTimersByTime(100);
    s.setTitle("AB");
    vi.advanceTimersByTime(100);
    s.setTitle("ABC");
    expect(useHistoryStore.getState().past).toHaveLength(1);
    undo();
    expect(title()).toBe("Untitled Paper");
  });

  it("clears redo after a new edit", () => {
    const s = useDocumentStore.getState();
    s.setTitle("One");
    undo();
    s.setTitle("Two");
    expect(useHistoryStore.getState().future).toHaveLength(0);
  });

  it("starts fresh when a different paper is loaded", () => {
    useDocumentStore.getState().setTitle("Edited");
    useDocumentStore.getState().loadDocument("another-paper", createBlankDocument());
    expect(useHistoryStore.getState().past).toHaveLength(0);
  });
});
