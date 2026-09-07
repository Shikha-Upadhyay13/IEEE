import { describe, it, expect } from "vitest";
import { parseBibtex } from "./bibtex";

describe("parseBibtex", () => {
  it("parses an @article entry with multiple authors and standard fields", () => {
    const bib = `@article{smith2023,
      author = {Smith, John and Davis, Robert A.},
      title = {Deep Learning in Robotics},
      journal = {IEEE Transactions on Robotics},
      year = {2023},
      volume = {39},
      pages = {1012--1028}
    }`;

    const parsed = parseBibtex(bib);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].authors).toBe("J. Smith and R. A. Davis");
    expect(parsed[0].title).toBe("Deep Learning in Robotics");
    expect(parsed[0].venue).toBe("IEEE Transactions on Robotics");
    expect(parsed[0].year).toBe("2023");
    expect(parsed[0].volume).toBe("39");
    expect(parsed[0].pages).toBe("1012-1028");
  });

  it("parses an @inproceedings entry with booktitle", () => {
    const bib = `@inproceedings{vaswani2017attention,
      author = {Vaswani, Ashish and Shazeer, Noam and Parmar, Niki},
      title = {Attention is All You Need},
      booktitle = {Advances in Neural Information Processing Systems (NeurIPS)},
      year = {2017},
      pages = {5998--6008}
    }`;

    const parsed = parseBibtex(bib);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].authors).toBe("A. Vaswani, N. Shazeer, and N. Parmar");
    expect(parsed[0].title).toBe("Attention is All You Need");
    expect(parsed[0].venue).toBe("Advances in Neural Information Processing Systems (NeurIPS)");
    expect(parsed[0].year).toBe("2017");
  });

  it("handles multiple bibtex entries in one string", () => {
    const bib = `
      @article{ref1,
        author = {Alice Wonderland},
        title = {Adventures in AI},
        journal = {IEEE Access},
        year = {2021}
      }
      @book{ref2,
        author = {Bob Builder},
        title = {Constructing Systems},
        publisher = {MIT Press},
        year = {2020}
      }
    `;

    const parsed = parseBibtex(bib);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].title).toBe("Adventures in AI");
    expect(parsed[1].title).toBe("Constructing Systems");
    expect(parsed[1].venue).toBe("MIT Press");
  });
});
