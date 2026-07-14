import type { Document } from "../types/document";

// Content sourced from IEEE's own official PES conference paper template/sample
// (https://ieee-pes.org/wp-content/uploads/2023/01/pg4-sample-conference-paper.pdf),
// chosen because it deliberately exercises every hard formatting case in one document:
// nested section/subsection headings, a table, a figure, and citations.
export const samplePaper: Document = {
  schemaVersion: 1,
  meta: { template: "ieee-conference", paperSize: "letter", pageLimit: 5 },
  titleBlock: {
    title: [
      {
        type: "text",
        text: "Preparation of a Formatted Conference Paper for an IEEE Power & Energy Society Conference",
      },
    ],
    authors: [
      { id: "a1", name: "First Author", affiliationRefs: ["aff1"] },
      { id: "a2", name: "Second Author", affiliationRefs: ["aff1"] },
      { id: "a3", name: "Third Author", affiliationRefs: ["aff2"] },
    ],
    affiliations: [
      { id: "aff1", text: "Dept. of Electrical Engineering, First University, City, Country" },
      { id: "aff2", text: "Dept. of Electrical Engineering, Second University, City, Country" },
    ],
  },
  abstract: {
    text:
      "Basic guidelines for the preparation of a technical paper for an IEEE Power & Energy Society " +
      "Conference are presented. This electronic document is a “live” template. The various " +
      "components of your paper [title, text, headings, etc.] are already defined, as illustrated by the " +
      "portions given in this document. The abstract is limited to 150 words and cannot contain " +
      "equations, figures, tables, or references. It should concisely state what was done, how it was " +
      "done, principal results, and their significance.",
  },
  keywords: ["conference", "formatting", "IEEE", "PES", "template"],
  body: [
    {
      type: "section",
      id: "sec-intro",
      heading: "Introduction",
      level: 1,
      children: [
        {
          type: "paragraph",
          id: "p-intro-1",
          content: [
            {
              type: "text",
              text:
                "This template provides authors with most of the formatting specifications needed for " +
                "preparing electronic versions of PES Conference papers. All standard paper components " +
                "have been specified for three reasons: (1) ease of use when formatting individual papers, " +
                "(2) automatic compliance to electronic requirements that facilitate the concurrent or " +
                "later production of electronic products, and (3) conformity of style throughout a " +
                "conference's proceedings.",
            },
          ],
        },
      ],
    },
    {
      type: "section",
      id: "sec-ease",
      heading: "Ease of Use",
      level: 1,
      children: [
        {
          type: "section",
          id: "sec-ease-template",
          heading: "Template",
          level: 2,
          children: [
            {
              type: "paragraph",
              id: "p-ease-template-1",
              content: [
                { type: "text", text: "This template has been tailored for output on US letter-sized paper." },
              ],
            },
          ],
        },
        {
          type: "section",
          id: "sec-ease-integrity",
          heading: "Maintaining the Integrity of the Specifications",
          level: 2,
          children: [
            {
              type: "paragraph",
              id: "p-ease-integrity-1",
              content: [
                {
                  type: "text",
                  text:
                    "The template is used to format your paper and style the text. All margins, column " +
                    "widths, line spaces, and text fonts are prescribed; please do not alter them, as shown in ",
                },
                { type: "xref", id: "xref-1", targetType: "table", targetId: "tbl-1" },
                { type: "text", text: " and " },
                { type: "xref", id: "xref-2", targetType: "figure", targetId: "fig-1" },
                { type: "text", text: "." },
              ],
            },
          ],
        },
      ],
    },
    {
      type: "section",
      id: "sec-prep",
      heading: "Conference Paper Preparation",
      level: 1,
      children: [
        {
          type: "paragraph",
          id: "p-prep-1",
          content: [
            {
              type: "text",
              text:
                "Conference papers are limited to a maximum of five pages for this venue " +
                "(configurable per venue, see the pageLimit field, not a fixed IEEE-wide rule) ",
            },
            { type: "citeRef", id: "cite-1", refId: "ref-fuller1988" },
            { type: "text", text: ". Please use automatic hyphenation and check your spelling." },
          ],
        },
        {
          type: "table",
          id: "tbl-1",
          width: "single-column",
          caption: [{ type: "text", text: "Table Type Styles" }],
          rows: [
            ["Table Column Heading", "Table column subheading", "Subheading", "Subheading"],
            ["copy", "More table copy", "", ""],
          ],
        },
        {
          type: "figure",
          id: "fig-1",
          width: "single-column",
          images: [{ url: "/sample-figure-placeholder.svg", alt: "Example of a figure" }],
          caption: [{ type: "text", text: "Example of a figure caption." }],
        },
        {
          type: "section",
          id: "sec-prep-abbrev",
          heading: "Abbreviations and Acronyms",
          level: 2,
          children: [
            {
              type: "paragraph",
              id: "p-prep-abbrev-1",
              content: [
                {
                  type: "text",
                  text:
                    "Define abbreviations and acronyms the first time they are used in the text, even " +
                    "after they have been defined in the abstract. Abbreviations such as IEEE, SI, ac, dc, " +
                    "and rms do not have to be defined ",
                },
                { type: "citeRef", id: "cite-2", refId: "ref-vidmar1992" },
                { type: "citeRef", id: "cite-3", refId: "ref-clarke1950" },
                { type: "text", text: "." },
              ],
            },
          ],
        },
      ],
    },
    {
      type: "section",
      id: "sec-acknowledgment",
      heading: "Acknowledgment",
      level: 1,
      children: [
        {
          type: "paragraph",
          id: "p-ack-1",
          content: [
            {
              type: "text",
              text:
                "The authors gratefully acknowledge the contributions of T. Edison, G. Westinghouse, " +
                "N. Tesla, A. Volta and A. Ampere to the electric power industry, building on prior " +
                "dissertation work ",
            },
            { type: "citeRef", id: "cite-4", refId: "ref-hwang1997" },
            { type: "text", text: " and applicable standards " },
            { type: "citeRef", id: "cite-5", refId: "ref-ieeestd2010" },
            { type: "text", text: "." },
          ],
        },
      ],
    },
  ],
  references: [
    {
      id: "ref-fuller1988",
      fields: { type: "periodical", authors: "J. F. Fuller, E. F. Fuchs, and K. J. Roesler", year: "1988" },
      renderedText:
        "J. F. Fuller, E. F. Fuchs, and K. J. Roesler, \"Influence of harmonics on power distribution " +
        "system protection,\" IEEE Trans. Power Delivery, vol. 3, pp. 549-557, Apr. 1988.",
    },
    {
      id: "ref-vidmar1992",
      fields: { type: "periodical", authors: "R. J. Vidmar", year: "1992" },
      renderedText:
        "R. J. Vidmar. (1992, Aug.). On the use of atmospheric plasmas as electromagnetic reflectors. " +
        "IEEE Trans. Plasma Sci. [Online]. 21(3), pp. 876-880.",
    },
    {
      id: "ref-clarke1950",
      fields: { type: "book", authors: "E. Clarke", year: "1950" },
      renderedText: "E. Clarke, Circuit Analysis of AC Power Systems, vol. I. New York: Wiley, 1950, p. 81.",
    },
    {
      id: "ref-hwang1997",
      fields: { type: "dissertation", authors: "S. Hwang", year: "1997" },
      renderedText:
        "S. Hwang, \"Frequency domain system identification of helicopter rotor dynamics incorporating " +
        "models with time periodic coefficients,\" Ph.D. dissertation, Dept. Aerosp. Eng., Univ. Maryland, " +
        "College Park, 1997.",
    },
    {
      id: "ref-ieeestd2010",
      fields: { type: "standard", authors: "IEEE", year: "2010" },
      renderedText: "IEEE Guide for Application of Shunt Power Capacitors, IEEE Std. 1036-2010, Sep. 2010.",
    },
  ],
};
