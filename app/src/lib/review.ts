import { z } from "zod";
import type { BodyNode, Document, InlineNode } from "../types/document";
import { resolveNumbering } from "./numbering";

const MAX_CONTEXT_CHARS = 24000;

const ReviewSchema = z.object({
  summary: z.string().default(""),
  notes: z
    .array(
      z.object({
        section: z.string().default(""),
        kind: z.enum(["clarity", "structure", "presentation"]).catch("clarity"),
        comment: z.string(),
      }),
    )
    .default([]),
});

export type Review = z.infer<typeof ReviewSchema>;
export type ReviewNote = Review["notes"][number];

/** Extracts the JSON review from model output, tolerating code fences or stray prose around it. */
export function parseReview(raw: string): Review | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const parsed = ReviewSchema.safeParse(JSON.parse(raw.slice(start, end + 1)));
    if (!parsed.success) return null;
    return { ...parsed.data, notes: parsed.data.notes.filter((n) => n.comment.trim() !== "") };
  } catch {
    return null;
  }
}

function inlineText(nodes: InlineNode[]): string {
  return nodes.map((n) => (n.type === "text" ? n.text : n.type === "citeRef" ? "[cite]" : "[ref]")).join("");
}

/** Plain-text rendering of the paper for the reviewer, with numbered headings. */
export function buildReviewContext(doc: Document): string {
  const resolved = resolveNumbering(doc);
  const lines: string[] = [
    `Title: ${inlineText(doc.titleBlock.title)}`,
    `Abstract: ${doc.abstract.text || "(empty)"}`,
    `Keywords: ${doc.keywords.join(", ") || "(none)"}`,
    "",
  ];
  const walk = (nodes: typeof resolved.body) => {
    for (const node of nodes) {
      if (node.type === "section") {
        lines.push("", `${node.resolvedNumber}. ${node.heading}`);
        walk(node.children);
      } else if (node.type === "paragraph") {
        lines.push(node.content.map((n) => (n.type === "text" ? n.text : n.type === "citeRef" ? `[${n.resolvedNumber}]` : `${n.resolvedNumber}`)).join(""));
      } else if (node.type === "figure") {
        lines.push(`[Figure ${node.resolvedNumber}: ${inlineText(node.caption) || "no caption"}]`);
      } else if (node.type === "table") {
        lines.push(`[Table ${node.resolvedNumber}: ${inlineText(node.caption) || "no caption"}]`);
      } else if (node.type === "equation") {
        lines.push(`[Equation ${node.resolvedNumber}]`);
      }
    }
  };
  walk(resolved.body);
  lines.push("", `References: ${doc.references.length}`);
  const text = lines.join("\n");
  return text.length > MAX_CONTEXT_CHARS ? `${text.slice(0, MAX_CONTEXT_CHARS)}\n[…paper truncated…]` : text;
}

function normalizeHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/^\s*(?:[ivxlc]+|\d+(?:\.\d+)*|[a-z])\.\s+/, "")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

/** Finds the section a note refers to, by heading, so the panel can jump there. */
export function findSectionForNote(body: BodyNode[], sectionName: string): string | null {
  const target = normalizeHeading(sectionName);
  if (!target) return null;
  let partial: string | null = null;
  const walk = (nodes: BodyNode[]): string | null => {
    for (const node of nodes) {
      if (node.type !== "section") continue;
      const heading = normalizeHeading(node.heading);
      if (heading === target) return node.id;
      if (!partial && heading && (heading.includes(target) || target.includes(heading))) partial = node.id;
      const found = walk(node.children);
      if (found) return found;
    }
    return null;
  };
  return walk(body) ?? partial;
}
