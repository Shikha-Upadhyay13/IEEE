import type { BodyNode, Document, InlineNode } from "../types/document";
import { getMode } from "./formats/modes";
import { getFormat } from "./formats/formats";
import { findUndefinedAcronyms } from "./acronyms";
import { MIN_PHOTO_DPI, figureImages, findLowResolutionFigures } from "./figureResolution";
import { findDuplicateReferences, hasHyphenPageRange, isUnverified, listsTooManyAuthors } from "./referenceChecks";

/** fail = blocker (stops a Submission-mode export), warn = should review, info = worth knowing. */
export type ChecklistStatus = "pass" | "info" | "warn" | "fail";

export const STATUS_LABEL: Record<ChecklistStatus, string> = {
  fail: "Blocker",
  warn: "Warning",
  info: "Note",
  pass: "Passed",
};

/** Where the editor should take the user to fix an item. */
export type ChecklistTarget =
  | { kind: "details" }
  | { kind: "references" }
  | { kind: "appearance" }
  | { kind: "block"; id: string };

export type ChecklistItem = {
  id: string;
  label: string;
  status: ChecklistStatus;
  detail: string;
  target?: ChecklistTarget;
  /** A safe automatic fix the panel can offer as a button. */
  fix?: ChecklistFix;
};

export type ChecklistFix = { id: "page-range-dashes"; label: string };

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}

function inlineText(nodes: InlineNode[]): string {
  return nodes.map((n) => (n.type === "text" ? n.text : "")).join("");
}

function walk(nodes: BodyNode[], visit: (node: BodyNode) => void) {
  for (const node of nodes) {
    visit(node);
    if (node.type === "section") walk(node.children, visit);
  }
}

function collectInline(body: BodyNode[]): InlineNode[] {
  const out: InlineNode[] = [];
  walk(body, (node) => {
    if (node.type === "paragraph") out.push(...node.content);
    else if (node.type === "figure" || node.type === "table") out.push(...node.caption);
  });
  return out;
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

function referenceName(fields: Record<string, string>, fallback: string) {
  return fields.title?.trim() || fields.author?.trim() || fallback;
}

export function runChecklist(
  doc: Document,
  pageCount: number | null,
  imageWidths: ReadonlyMap<string, number> = new Map()
): ChecklistItem[] {
  const items: ChecklistItem[] = [];

  const title = inlineText(doc.titleBlock.title).trim();
  items.push({
    id: "title",
    label: "Title",
    status: title ? "pass" : "fail",
    detail: title ? "Your paper has a title." : "Add a title to your paper.",
    target: { kind: "details" },
  });

  const namedAuthors = doc.titleBlock.authors.filter((a) => a.name.trim() !== "");
  items.push({
    id: "authors",
    label: "Authors",
    status: namedAuthors.length > 0 ? "pass" : "fail",
    detail:
      namedAuthors.length > 0
        ? `${plural(namedAuthors.length, "author")} listed.`
        : "Add at least one author with a name.",
    target: { kind: "details" },
  });

  const format = getFormat(doc.meta);
  const { min, max } = format.abstractWords;
  const abstractWords = countWords(doc.abstract.text);
  items.push({
    id: "abstract",
    label: min > 0 ? `Abstract (${min}–${max} words)` : `Abstract (${max} words or fewer)`,
    status: abstractWords === 0 ? "fail" : abstractWords > max || abstractWords < min ? "warn" : "pass",
    detail:
      abstractWords === 0
        ? "Write an abstract."
        : abstractWords > max
          ? `${abstractWords} words — ${abstractWords - max} over the ${format.label} limit.`
          : abstractWords < min
            ? `${abstractWords} words — ${format.label} abstracts are usually at least ${min}.`
            : `${plural(abstractWords, "word")}.`,
    target: { kind: "details" },
  });

  const keywords = doc.keywords.filter((k) => k.trim() !== "");
  items.push({
    id: "keywords",
    label: "Keywords",
    status: keywords.length > 0 ? "pass" : "warn",
    detail: keywords.length > 0 ? `${plural(keywords.length, "keyword")}.` : "Add index terms (keywords) for your paper.",
    target: { kind: "details" },
  });

  const mode = getMode(doc.meta);
  items.push({
    id: "mode",
    label: "IEEE Submission mode",
    status: mode === "submission" ? "pass" : mode === "draft" ? "warn" : "fail",
    detail:
      mode === "submission"
        ? "Styling is locked to the IEEE template (Times New Roman, no page numbers, plain links)."
        : mode === "draft"
          ? "Draft mode can add page numbers, styled links and a DRAFT mark — switch to Submission before submitting."
          : "Custom mode is not IEEE-compliant — switch to Submission before submitting.",
    target: { kind: "details" },
  });

  const limit = doc.meta.pageLimit;
  if (limit === null) {
    items.push({
      id: "page-limit",
      label: "Page limit",
      status: "warn",
      detail: "Set your venue's page limit so we can check it.",
      target: { kind: "details" },
    });
  } else if (pageCount === null) {
    items.push({
      id: "page-limit",
      label: "Page limit",
      status: "warn",
      detail: "Waiting for the preview to finish rendering.",
    });
  } else {
    items.push({
      id: "page-limit",
      label: "Page limit",
      status: pageCount <= limit ? "pass" : "fail",
      detail:
        pageCount <= limit
          ? `${pageCount} of ${plural(limit, "page")}.`
          : `${pageCount} pages — ${plural(pageCount - limit, "page")} over the ${limit}-page limit.`,
      target: { kind: "details" },
    });
  }

  const inline = collectInline(doc.body);
  const citedIds = new Set(inline.flatMap((n) => (n.type === "citeRef" ? [n.refId] : [])));
  const refIds = new Set(doc.references.map((r) => r.id));
  const uncited = doc.references.filter((r) => !citedIds.has(r.id));
  const brokenCites = [...citedIds].filter((id) => !refIds.has(id));
  if (doc.references.length === 0) {
    items.push({
      id: "references-cited",
      label: "Every reference cited",
      status: "warn",
      detail: "Your paper has no references yet.",
      target: { kind: "references" },
    });
  } else {
    items.push({
      id: "references-cited",
      label: "Every reference cited",
      status: uncited.length === 0 && brokenCites.length === 0 ? "pass" : "fail",
      detail:
        uncited.length > 0
          ? `Not cited in the text: ${uncited.map((r, i) => referenceName(r.fields, `reference ${i + 1}`)).join("; ")}.`
          : brokenCites.length > 0
            ? `${plural(brokenCites.length, "citation")} point to a deleted reference.`
            : `All ${plural(doc.references.length, "reference")} are cited.`,
      target: { kind: "references" },
    });

    const refName = (i: number) => referenceName(doc.references[i].fields, `reference ${i + 1}`);
    const empty = doc.references.flatMap((r, i) => (r.renderedText.trim() ? [] : [i]));
    items.push({
      id: "references-complete",
      label: "No empty references",
      status: empty.length === 0 ? "pass" : "fail",
      detail:
        empty.length === 0
          ? "Every reference has text."
          : `Empty: ${empty.map((i) => `[${i + 1}]`).join(", ")}. Fill them in or delete them.`,
      target: { kind: "references" },
    });

    const duplicates = findDuplicateReferences(doc.references);
    items.push({
      id: "references-duplicates",
      label: "No duplicate references",
      status: duplicates.length === 0 ? "pass" : "warn",
      detail:
        duplicates.length === 0
          ? "No two references look like the same work."
          : `These look like the same work: ${duplicates
              .map(([a, b]) => `${refName(a)} and ${refName(b)}`)
              .join("; ")}.`,
      target: { kind: "references" },
    });

    const hyphenated = doc.references.filter((r) => hasHyphenPageRange(r.renderedText)).length;
    const longAuthorLists = doc.references.filter(listsTooManyAuthors).length;
    const styleNotes = [
      hyphenated ? `${plural(hyphenated, "page range")} use a hyphen instead of an en dash (pp. 549–557).` : "",
      longAuthorLists
        ? `${plural(longAuthorLists, "reference")} list more than six authors — IEEE uses the first author followed by et al.`
        : "",
    ].filter(Boolean);
    items.push({
      id: "references-style",
      label: "IEEE reference style",
      status: styleNotes.length === 0 ? "pass" : "info",
      detail: styleNotes.length === 0 ? "Page ranges and author lists follow IEEE style." : styleNotes.join(" "),
      target: { kind: "references" },
      fix: hyphenated ? { id: "page-range-dashes", label: "Use en dashes" } : undefined,
    });

    const unverified = doc.references.filter(isUnverified).length;
    if (unverified > 0) {
      items.push({
        id: "references-verified",
        label: "References checked against Crossref",
        status: "info",
        detail: `${plural(unverified, "reference")} not yet checked. Use Verify in References to catch wrong years, volumes and titles.`,
        target: { kind: "references" },
      });
    }
  }

  const xrefTargets = new Set(inline.flatMap((n) => (n.type === "xref" ? [n.targetId] : [])));
  const floats: { id: string; kind: "figure" | "table"; caption: string }[] = [];
  walk(doc.body, (node) => {
    if (node.type === "figure" || node.type === "table") {
      floats.push({ id: node.id, kind: node.type, caption: inlineText(node.caption).trim() });
    }
  });

  const unreferenced = floats.filter((f) => !xrefTargets.has(f.id));
  const unreferencedFigures = unreferenced.filter((f) => f.kind === "figure").length;
  const unreferencedTables = unreferenced.length - unreferencedFigures;
  items.push({
    id: "floats-referenced",
    label: "Every figure and table referenced",
    status: unreferenced.length === 0 ? "pass" : "warn",
    detail:
      floats.length === 0
        ? "No figures or tables."
        : unreferenced.length === 0
          ? "Every figure and table is referred to in the text."
          : `Not referred to in the text: ${[
              unreferencedFigures ? plural(unreferencedFigures, "figure") : "",
              unreferencedTables ? plural(unreferencedTables, "table") : "",
            ]
              .filter(Boolean)
              .join(" and ")}.`,
    target: unreferenced[0] ? { kind: "block", id: unreferenced[0].id } : undefined,
  });

  const emptyCaptions = floats.filter((f) => f.caption === "");
  items.push({
    id: "captions",
    label: "No empty captions",
    status: emptyCaptions.length === 0 ? "pass" : "fail",
    detail:
      floats.length === 0
        ? "No figures or tables."
        : emptyCaptions.length === 0
          ? "Every figure and table has a caption."
          : `${plural(emptyCaptions.length, "figure or table", "figures or tables")} without a caption.`,
    target: emptyCaptions[0] ? { kind: "block", id: emptyCaptions[0].id } : undefined,
  });

  const figures: Extract<BodyNode, { type: "figure" }>[] = [];
  walk(doc.body, (node) => {
    if (node.type === "figure" && figureImages(node).length > 0) figures.push(node);
  });
  if (figures.length > 0) {
    const low = findLowResolutionFigures(figures, doc.meta, imageWidths);
    items.push({
      id: "figure-resolution",
      label: "Figure resolution",
      status: low.length === 0 ? "pass" : "warn",
      detail:
        low.length === 0
          ? `Images are at least ${MIN_PHOTO_DPI} dpi at their printed size.`
          : `${plural(low.length, "figure")} below ${MIN_PHOTO_DPI} dpi at printed size (lowest ${Math.min(
              ...low.map((f) => f.dpi)
            )} dpi). IEEE asks for ${MIN_PHOTO_DPI} dpi for photos and 600 dpi for line art.`,
      target: low[0] ? { kind: "block", id: low[0].id } : undefined,
    });
  }

  const paragraphs: { id: string; text: string }[] = [];
  walk(doc.body, (node) => {
    if (node.type === "paragraph") paragraphs.push({ id: node.id, text: inlineText(node.content) });
  });
  const undefinedAcronyms = findUndefinedAcronyms(paragraphs);
  const shown = undefinedAcronyms.slice(0, 5).map((a) => a.acronym);
  const more = undefinedAcronyms.length - shown.length;
  items.push({
    id: "acronyms",
    label: "Acronyms defined on first use",
    status: undefinedAcronyms.length === 0 ? "pass" : "info",
    detail:
      undefinedAcronyms.length === 0
        ? "Every acronym is spelled out the first time it appears."
        : `Spell these out the first time, like "convolutional neural network (CNN)": ${shown.join(", ")}${
            more > 0 ? ` and ${more} more` : ""
          }.`,
    target: undefinedAcronyms[0] ? { kind: "block", id: undefinedAcronyms[0].blockId } : undefined,
  });

  return items;
}

export function checklistSummary(items: ChecklistItem[]) {
  return {
    fail: items.filter((i) => i.status === "fail").length,
    warn: items.filter((i) => i.status === "warn").length,
    info: items.filter((i) => i.status === "info").length,
    pass: items.filter((i) => i.status === "pass").length,
  };
}
