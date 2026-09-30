export type Guide = { path: string; name: string; blurb: string };

export const GUIDES: Guide[] = [
  {
    path: "/guides/ieee-reference-format",
    name: "IEEE reference formatter",
    blurb: "Fill in the details (or paste a DOI) and get a correctly punctuated IEEE reference.",
  },
  {
    path: "/guides/bibtex-to-ieee",
    name: "BibTeX to IEEE converter",
    blurb: "Paste BibTeX entries from Google Scholar or Zotero and get a numbered IEEE reference list.",
  },
  {
    path: "/guides/ieee-abstract-word-count",
    name: "IEEE abstract word counter",
    blurb: "Check your abstract against common IEEE word limits and catch things abstracts shouldn't contain.",
  },
];
