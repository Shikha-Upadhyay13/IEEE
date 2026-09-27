import type { BodyNode, Document, InlineNode } from "../types/document";

export type ChecklistStatus = "pass" | "warn" | "fail";

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
};

export const ABSTRACT_WORD_LIMIT = 150;

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

export function runChecklist(doc: Document, pageCount: number | null): ChecklistItem[] {
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

  const abstractWords = countWords(doc.abstract.text);
  items.push({
    id: "abstract",
    label: `Abstract (${ABSTRACT_WORD_LIMIT} words or fewer)`,
    status: abstractWords === 0 ? "fail" : abstractWords > ABSTRACT_WORD_LIMIT ? "warn" : "pass",
    detail:
      abstractWords === 0
        ? "Write an abstract."
        : abstractWords > ABSTRACT_WORD_LIMIT
          ? `${abstractWords} words — ${abstractWords - ABSTRACT_WORD_LIMIT} over the usual IEEE limit.`
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

  const font = doc.meta.fontFamily ?? "times";
  items.push({
    id: "font",
    label: "Times New Roman",
    status: font === "times" ? "pass" : "fail",
    detail:
      font === "times"
        ? "The paper uses Times New Roman."
        : "IEEE requires Times New Roman — switch the font back before submitting.",
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

  return items;
}

export function checklistSummary(items: ChecklistItem[]) {
  return {
    fail: items.filter((i) => i.status === "fail").length,
    warn: items.filter((i) => i.status === "warn").length,
    pass: items.filter((i) => i.status === "pass").length,
  };
}
