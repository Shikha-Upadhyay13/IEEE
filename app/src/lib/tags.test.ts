import { describe, expect, it } from "vitest";
import { allTags, hasTag, parseTags } from "./tags";

describe("parseTags", () => {
  it("trims, collapses spaces and drops empty or repeated tags", () => {
    expect(parseTags(" ICRA  2027, thesis,,Thesis , ")).toEqual(["ICRA 2027", "thesis"]);
  });

  it("caps the number of tags", () => {
    expect(parseTags(Array.from({ length: 30 }, (_, i) => `t${i}`).join(","))).toHaveLength(20);
  });
});

describe("allTags and hasTag", () => {
  const papers = [{ tags: ["thesis", "ICRA"] }, { tags: ["Thesis", "draft"] }];

  it("lists each tag once, alphabetically", () => {
    expect(allTags(papers)).toEqual(["draft", "ICRA", "thesis"]);
  });

  it("matches case-insensitively", () => {
    expect(hasTag(papers[1], "THESIS")).toBe(true);
    expect(hasTag(papers[1], "ICRA")).toBe(false);
  });
});
