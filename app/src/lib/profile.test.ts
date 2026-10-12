import { describe, expect, it, vi } from "vitest";

vi.mock("../supabaseClient", () => ({ supabase: {} }));

import { EMPTY_PROFILE, applyNewPaperDefaults, editorAttributes, fromRow, normalizeOrcid } from "./profile";
import { createBlankDocument } from "./blankDocument";

describe("normalizeOrcid", () => {
  it("accepts URLs, spaces and missing dashes, and checks the check digit", () => {
    expect(normalizeOrcid("https://orcid.org/0000-0002-1825-0097")).toBe("0000-0002-1825-0097");
    expect(normalizeOrcid("0000 0002 1825 0097")).toBe("0000-0002-1825-0097");
    expect(normalizeOrcid("000000021694233x")).toBe("0000-0002-1694-233X");
    expect(normalizeOrcid("0000-0002-1825-0098")).toBeNull();
    expect(normalizeOrcid("0000-0002-1825")).toBeNull();
  });
});

describe("fromRow", () => {
  it("drops stored defaults that no longer validate", () => {
    const profile = fromRow({
      full_name: "Ana",
      orcid: null,
      affiliation: null,
      paper_defaults: { paperSize: "tabloid" },
      editor_preferences: { spellcheck: false },
    });
    expect(profile.paperDefaults).toEqual({});
    expect(profile.editorPreferences).toEqual({ spellcheck: false });
    expect(fromRow(null)).toEqual(EMPTY_PROFILE);
  });
});

describe("editorAttributes", () => {
  it("passes the dialect to the browser and keeps spell check on unless turned off", () => {
    expect(editorAttributes(EMPTY_PROFILE)).toEqual({ spellCheck: true });
    expect(
      editorAttributes({ ...EMPTY_PROFILE, paperDefaults: { dialect: "en-GB" }, editorPreferences: { spellcheck: false } }),
    ).toEqual({ lang: "en-GB", spellCheck: false });
  });
});

describe("applyNewPaperDefaults", () => {
  it("sets format, size and mode, and adds the account holder as first author", () => {
    const doc = applyNewPaperDefaults(
      createBlankDocument(),
      { ...EMPTY_PROFILE, fullName: " Ana Diaz ", affiliation: "Uni Lab", paperDefaults: { paperSize: "a4", mode: "draft" } },
      "ana@uni.edu",
    );
    expect(doc.meta).toMatchObject({ paperSize: "a4", mode: "draft", template: "ieee-conference" });
    const [author] = doc.titleBlock.authors;
    expect(author).toMatchObject({ name: "Ana Diaz", email: "ana@uni.edu" });
    expect(doc.titleBlock.affiliations).toEqual([{ id: author.affiliationRefs[0], text: "Uni Lab" }]);
  });

  it("leaves authors alone without a name, or when the paper already has some", () => {
    expect(applyNewPaperDefaults(createBlankDocument(), EMPTY_PROFILE).titleBlock.authors).toEqual([]);
    const withAuthor = createBlankDocument();
    withAuthor.titleBlock.authors.push({ id: "a1", name: "Bo", affiliationRefs: [] });
    expect(applyNewPaperDefaults(withAuthor, { ...EMPTY_PROFILE, fullName: "Ana" }).titleBlock.authors).toHaveLength(1);
  });
});
