import { describe, expect, it } from "vitest";
import { findUndefinedAcronyms } from "./acronyms";

describe("findUndefinedAcronyms", () => {
  it("accepts acronyms defined in parentheses on first use", () => {
    expect(
      findUndefinedAcronyms([
        { id: "p1", text: "We train a convolutional neural network (CNN) on images." },
        { id: "p2", text: "The CNN and its CNNs converge." },
      ])
    ).toEqual([]);
  });

  it("reports the first use of an undefined acronym once", () => {
    expect(
      findUndefinedAcronyms([
        { id: "p1", text: "The LSTM beats the baseline." },
        { id: "p2", text: "Later, long short-term memory (LSTM) is defined." },
      ])
    ).toEqual([{ acronym: "LSTM", blockId: "p1" }]);
  });

  it("ignores well-known acronyms, roman numerals and single capitals", () => {
    expect(findUndefinedAcronyms([{ id: "p1", text: "See Section III. An IEEE AC grid. A test." }])).toEqual([]);
  });
});
