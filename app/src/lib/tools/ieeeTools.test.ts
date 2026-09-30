import { describe, expect, it } from "vitest";
import { abstractStats, bibtexToIeee, formatAuthorNames, formatIeeeReference, numberedList } from "./ieeeTools";

describe("formatAuthorNames", () => {
  it("converts full names to initials and joins them IEEE-style", () => {
    expect(formatAuthorNames("Jane Smith")).toBe("J. Smith");
    expect(formatAuthorNames("Jane Smith; Doe, John")).toBe("J. Smith and J. Doe");
    expect(formatAuthorNames("Ada Lovelace\nAlan Mathison Turing\nGrace Hopper")).toBe(
      "A. Lovelace, A. M. Turing, and G. Hopper"
    );
  });

  it("keeps existing initials and hyphenated first names", () => {
    expect(formatAuthorNames("J. F. Fuller")).toBe("J. F. Fuller");
    expect(formatAuthorNames("Jean-Pierre Serre")).toBe("J.-P. Serre");
  });

  it("uses et al. beyond six authors", () => {
    expect(formatAuthorNames("A One; B Two; C Three; D Four; E Five; F Six; G Seven")).toBe("A. One et al.");
  });
});

describe("formatIeeeReference", () => {
  it("renders the journal shape", () => {
    expect(
      formatIeeeReference({
        authors: "J. F. Fuller, E. F. Fuchs, and K. J. Roesler",
        title: "Influence of harmonics on power distribution system protection",
        venue: "IEEE Trans. Power Del.",
        volume: "3",
        pages: "549-557",
        year: "1988",
      })
    ).toBe(
      'J. F. Fuller, E. F. Fuchs, and K. J. Roesler, "Influence of harmonics on power distribution system protection," IEEE Trans. Power Del., vol. 3, pp. 549-557, 1988.'
    );
  });

  it("appends the DOI when given", () => {
    expect(
      formatIeeeReference({ authors: "A. B", title: "T", venue: "V", volume: "", pages: "", year: "2020", doi: "10.1/x" })
    ).toBe('A. B, "T," V, 2020. doi: 10.1/x.');
  });
});

describe("bibtexToIeee", () => {
  const bib = `@article{a, author={Smith, John and Davis, Robert}, title={{Robot Navigation}}, journal={IEEE Trans. Robot.}, year={2023}, volume={39}, pages={1012--1028}}
@misc{b, title={Only a title}}`;

  it("numbers entries and flags missing fields", () => {
    const refs = bibtexToIeee(bib);
    expect(refs).toHaveLength(2);
    expect(refs[0].text).toBe('J. Smith and R. Davis, "Robot Navigation," IEEE Trans. Robot., vol. 39, pp. 1012-1028, 2023.');
    expect(refs[0].missing).toEqual([]);
    expect(refs[1].missing).toEqual(["authors", "venue", "year"]);
    expect(numberedList(refs).split("\n")[1]).toBe('[2] "Only a title".');
  });
});

describe("abstractStats", () => {
  it("counts words and sentences", () => {
    const s = abstractStats("We study X. Results show Y!");
    expect(s.words).toBe(6);
    expect(s.sentences).toBe(2);
    expect(s.warnings).toEqual([]);
  });

  it("warns about citations, math and figure references", () => {
    const s = abstractStats("As in [3], we minimise $f(x)$ as shown in Fig. 2.");
    expect(s.warnings).toHaveLength(3);
  });

  it("handles empty input", () => {
    expect(abstractStats("  ")).toEqual({ words: 0, characters: 0, sentences: 0, warnings: [] });
  });
});
