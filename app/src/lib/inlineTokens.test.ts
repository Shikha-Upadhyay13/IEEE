import { describe, it, expect } from "vitest";
import { inlineToTokenText, tokenTextToInline } from "./inlineTokens";
import { wordDiff } from "./wordDiff";
import type { InlineNode } from "../types/document";

const cite: InlineNode = { type: "citeRef", id: "c1", refId: "r1" };
const xref: InlineNode = { type: "xref", id: "x1", targetType: "figure", targetId: "f1" };

describe("inline tokens", () => {
  it("round-trips citations and cross-references through placeholders", () => {
    const content: InlineNode[] = [
      { type: "text", text: "Prior work " },
      cite,
      { type: "text", text: " is shown in " },
      xref,
      { type: "text", text: "." },
    ];
    const { text, tokens } = inlineToTokenText(content);
    expect(text).toBe("Prior work ⟦C1⟧ is shown in ⟦X1⟧.");
    const back = tokenTextToInline("Earlier studies ⟦C1⟧ appear in ⟦X1⟧.", tokens);
    expect(back.content).toEqual([
      { type: "text", text: "Earlier studies " },
      cite,
      { type: "text", text: " appear in " },
      xref,
      { type: "text", text: "." },
    ]);
    expect(back.invented).toEqual([]);
    expect(back.missing).toEqual([]);
  });

  it("drops invented placeholders and typed citation numbers", () => {
    const { tokens } = inlineToTokenText([{ type: "text", text: "A claim " }, cite]);
    const back = tokenTextToInline("A claim ⟦C1⟧ supported by others ⟦C2⟧ [4], [5]-[7].", tokens);
    expect(back.invented).toEqual(["C2"]);
    expect(back.strayCitations).toEqual(["[4], [5]-[7]"]);
    expect(back.content).toEqual([
      { type: "text", text: "A claim " },
      cite,
      { type: "text", text: " supported by others." },
    ]);
  });

  it("re-attaches citations the model dropped", () => {
    const { tokens } = inlineToTokenText([{ type: "text", text: "Fact " }, cite]);
    const back = tokenTextToInline("A fact.", tokens);
    expect(back.missing).toEqual(["C1"]);
    expect(back.content[back.content.length - 1]).toEqual(cite);
  });

  it("notes when the original had bold or italic text", () => {
    expect(inlineToTokenText([{ type: "text", text: "x", bold: true }]).hadFormatting).toBe(true);
  });
});

describe("wordDiff", () => {
  it("marks added and removed words", () => {
    expect(wordDiff("the quick fox", "the slow fox")).toEqual([
      { type: "same", text: "the " },
      { type: "del", text: "quick" },
      { type: "add", text: "slow" },
      { type: "same", text: " fox" },
    ]);
  });
});
