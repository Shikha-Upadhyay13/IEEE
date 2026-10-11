import { describe, it, expect } from "vitest";
import { compareWithWork, titleSimilarity } from "./referenceVerify";
import type { CrossrefWork } from "./doiLookup";
import { emptyReferenceFields, type ReferenceFields } from "./generateReferenceText";

const work: CrossrefWork = {
  DOI: "10.1109/5.771073",
  title: ["Toward unrestricted use of public genomic data"],
  author: [{ given: "Jane", family: "Doe" }],
  "container-title": ["Proceedings of the IEEE"],
  volume: "87",
  issued: { "date-parts": [[1999, 7]] },
};

function fields(overrides: Partial<ReferenceFields>): ReferenceFields {
  return { ...emptyReferenceFields, ...overrides };
}

describe("titleSimilarity", () => {
  it("ignores case and punctuation", () => {
    expect(titleSimilarity("Deep Learning: A Survey", "deep learning a survey")).toBe(1);
  });
  it("is zero for unrelated or empty titles", () => {
    expect(titleSimilarity("", "anything")).toBe(0);
    expect(titleSimilarity("quantum networks", "protein folding")).toBe(0);
  });
});

describe("compareWithWork", () => {
  it("verifies a matching title and year", () => {
    expect(
      compareWithWork(fields({ title: "Toward Unrestricted Use of Public Genomic Data.", year: "1999" }), work),
    ).toEqual({ status: "verified", doi: "10.1109/5.771073" });
  });

  it("flags a wrong year as a mismatch and offers the CrossRef details", () => {
    const result = compareWithWork(fields({ title: "Toward unrestricted use of public genomic data", year: "2001" }), work);
    expect(result.status).toBe("mismatch");
    if (result.status !== "mismatch") return;
    expect(result.differences[0]).toContain("1999");
    expect(result.crossref.venue).toBe("Proceedings of the IEEE");
  });

  it("carries Crossref retraction and withdrawal notices", () => {
    const title = "Toward unrestricted use of public genomic data";
    const retracted = { ...work, "updated-by": [{ type: "retraction", DOI: "10.1109/notice.1" }] };
    expect(compareWithWork(fields({ title, year: "1999" }), retracted)).toEqual({
      status: "verified",
      doi: "10.1109/5.771073",
      retraction: "Retracted — see notice 10.1109/notice.1",
    });
    const notice = { ...work, "update-to": [{ type: "retraction", DOI: "10.1/original" }] };
    const result = compareWithWork(fields({ title }), notice);
    expect(result.status === "verified" && result.retraction).toContain("retraction notice for 10.1/original");
    const corrected = { ...work, "updated-by": [{ type: "correction", DOI: "10.1/fix" }] };
    expect(compareWithWork(fields({ title }), corrected)).toEqual({ status: "verified", doi: "10.1109/5.771073" });
  });

  it("reports a clearly different paper as not found", () => {
    expect(compareWithWork(fields({ title: "Graph neural networks for traffic prediction" }), work).status).toBe(
      "not-found",
    );
  });
});
