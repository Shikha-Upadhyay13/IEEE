import { describe, it, expect, beforeEach } from "vitest";
import { useDocumentStore } from "./documentStore";
import { createBlankDocument } from "../lib/blankDocument";

function titleBlock() {
  return useDocumentStore.getState().document.titleBlock;
}

describe("author and affiliation actions", () => {
  beforeEach(() => {
    const doc = createBlankDocument();
    useDocumentStore.getState().loadDocument("doc-1", doc);
  });

  it("adds an author linked to the first affiliation when one exists", () => {
    const s = useDocumentStore.getState();
    s.addAffiliation();
    s.addAuthor();
    const { authors, affiliations } = titleBlock();
    expect(authors).toHaveLength(1);
    expect(authors[0].affiliationRefs).toEqual([affiliations[0].id]);
  });

  it("updates and removes an author", () => {
    const s = useDocumentStore.getState();
    s.addAuthor();
    const id = titleBlock().authors[0].id;
    s.updateAuthor(id, { name: "Ada Lovelace", email: "ada@example.com" });
    expect(titleBlock().authors[0]).toMatchObject({ name: "Ada Lovelace", email: "ada@example.com" });
    s.removeAuthor(id);
    expect(titleBlock().authors).toHaveLength(0);
  });

  it("toggles an author's affiliation membership", () => {
    const s = useDocumentStore.getState();
    s.addAuthor();
    s.addAffiliation();
    const authorId = titleBlock().authors[0].id;
    const affId = titleBlock().affiliations[0].id;
    s.toggleAuthorAffiliation(authorId, affId);
    expect(titleBlock().authors[0].affiliationRefs).toEqual([affId]);
    s.toggleAuthorAffiliation(authorId, affId);
    expect(titleBlock().authors[0].affiliationRefs).toEqual([]);
  });

  it("removing an affiliation also unlinks it from every author", () => {
    const s = useDocumentStore.getState();
    s.addAffiliation();
    s.addAuthor();
    const affId = titleBlock().affiliations[0].id;
    s.removeAffiliation(affId);
    expect(titleBlock().affiliations).toHaveLength(0);
    expect(titleBlock().authors[0].affiliationRefs).toEqual([]);
  });

  it("sets and clears the page limit", () => {
    const s = useDocumentStore.getState();
    s.setPageLimit(6);
    expect(useDocumentStore.getState().document.meta.pageLimit).toBe(6);
    s.setPageLimit(null);
    expect(useDocumentStore.getState().document.meta.pageLimit).toBeNull();
  });
});
