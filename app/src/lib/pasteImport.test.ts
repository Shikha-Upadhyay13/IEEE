import { describe, it, expect } from "vitest";
import { blocksToImport, parseNumberedHeading, textToBlocks } from "./pasteImport";
import type { BodyNode } from "../types/document";

function outline(nodes: BodyNode[]): unknown[] {
  return nodes.map((n) =>
    n.type === "section"
      ? { [n.heading]: outline(n.children) }
      : n.type === "paragraph" && n.content[0]?.type === "text"
        ? n.content[0].text
        : n.type,
  );
}

describe("parseNumberedHeading", () => {
  it("reads IEEE roman, numeric and lettered headings", () => {
    expect(parseNumberedHeading("II. RELATED WORK")).toEqual({ text: "Related Work", level: 1 });
    expect(parseNumberedHeading("3.1 Datasets")).toEqual({ text: "Datasets", level: 2 });
    expect(parseNumberedHeading("B. Experimental Setup")).toEqual({ text: "Experimental Setup", level: 2 });
  });

  it("treats a single letter that is also a roman numeral by its case", () => {
    expect(parseNumberedHeading("C. Training Details")?.level).toBe(2);
    expect(parseNumberedHeading("V. CONCLUSION")?.level).toBe(1);
  });

  it("rejects sentences and numbers that are not headings", () => {
    expect(parseNumberedHeading("1. We first collect the data.")).toBeNull();
    expect(parseNumberedHeading("2019 was a year")).toBeNull();
  });
});

describe("textToBlocks + blocksToImport", () => {
  const pasted = [
    "Efficient Edge Inference for Tiny Devices",
    "Jane Doe, Dept. of CS, Example University",
    "",
    "Abstract—We present a method for running models on microcontrollers.",
    "",
    "Index Terms—edge computing, TinyML, quantization.",
    "",
    "I. INTRODUCTION",
    "Edge devices are everywhere.",
    "",
    "II. METHOD",
    "",
    "A. Quantization",
    "We quantize weights to 8 bits.",
    "",
    "III. CONCLUSION",
    "It works.",
    "",
    "REFERENCES",
    "[1] A. Author, Some paper, 2020.",
    "[2] B. Author, Another paper, 2021.",
  ].join("\n");

  const result = blocksToImport(textToBlocks(pasted));

  it("peels off title, abstract and keywords", () => {
    expect(result.title).toBe("Efficient Edge Inference for Tiny Devices");
    expect(result.abstract).toBe("We present a method for running models on microcontrollers.");
    expect(result.keywords).toEqual(["edge computing", "TinyML", "quantization"]);
    expect(result.skippedFrontMatterLines).toBe(1);
  });

  it("nests subsections and skips the reference list", () => {
    expect(outline(result.body)).toEqual([
      { Introduction: ["Edge devices are everywhere."] },
      { Method: [{ Quantization: ["We quantize weights to 8 bits."] }] },
      { Conclusion: ["It works."] },
    ]);
    expect(result.sectionCount).toBe(4);
    expect(result.skippedReferenceLines).toBe(2);
  });

  it("gives nested sections increasing levels", () => {
    const method = result.body[1];
    expect(method.type === "section" && method.children[0].type === "section" && method.children[0].level).toBe(2);
  });

  it("keeps unstructured text as paragraphs", () => {
    const plain = blocksToImport(textToBlocks("First paragraph here.\n\nSecond paragraph here."));
    expect(plain.title).toBeNull();
    expect(plain.paragraphCount).toBe(2);
    expect(plain.sectionCount).toBe(0);
  });

  it("uses explicit heading blocks from HTML", () => {
    const fromHtml = blocksToImport([
      { kind: "heading", level: 0, text: "My Title" },
      { kind: "heading", level: 1, text: "Background" },
      { kind: "paragraph", text: "Some text." },
      { kind: "heading", level: 2, text: "Prior Art" },
      { kind: "paragraph", text: "More text." },
      { kind: "heading", level: 1, text: "Results" },
    ]);
    expect(fromHtml.title).toBe("My Title");
    expect(outline(fromHtml.body)).toEqual([{ Background: ["Some text.", { "Prior Art": ["More text."] }] }, { Results: [] }]);
  });
});
