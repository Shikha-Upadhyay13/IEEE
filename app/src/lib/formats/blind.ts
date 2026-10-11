import type { BodyNode, Document } from "../../types/document";

export function isAcknowledgmentHeading(heading: string): boolean {
  return /^\s*acknowledge?ments?\b/i.test(heading);
}

/** The body without acknowledgment sections, which identify authors through funders and colleagues. */
export function withoutAcknowledgments(body: BodyNode[]): BodyNode[] {
  return body.filter((node) => node.type !== "section" || !isAcknowledgmentHeading(node.heading));
}

export type NameMention = { name: string; blockId: string };

/**
 * Author names that still appear in the text of a double-blind paper — usually
 * "our previous work [3] by Smith" or a leftover signature.
 */
export function findAuthorMentions(
  authors: Document["titleBlock"]["authors"],
  blocks: { id: string; text: string }[]
): NameMention[] {
  const mentions: NameMention[] = [];
  for (const author of authors) {
    const surname = author.name.trim().split(/\s+/).at(-1) ?? "";
    if (surname.replace(/\W/g, "").length < 3) continue;
    const pattern = new RegExp(`\\b${surname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    const block = blocks.find((b) => pattern.test(b.text));
    if (block) mentions.push({ name: author.name.trim(), blockId: block.id });
  }
  return mentions;
}
