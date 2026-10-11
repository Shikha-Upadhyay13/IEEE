import { supabase } from "../supabaseClient";
import type { BodyNode, InlineNode } from "../types/document";
import { inlineToTokenText, tokenTextToInline } from "./inlineTokens";

export type SuggestionStatus = "open" | "accepted" | "rejected";

export type Suggestion = {
  id: string;
  blockId: string;
  authorId: string | null;
  proposed: InlineNode[];
  baseText: string;
  note: string | null;
  status: SuggestionStatus;
  createdAt: string;
};

type Row = {
  id: string;
  block_id: string;
  author_id: string | null;
  proposed: InlineNode[];
  base_text: string;
  note: string | null;
  status: SuggestionStatus;
  created_at: string;
};

const COLUMNS = "id, block_id, author_id, proposed, base_text, note, status, created_at";

const fromRow = (r: Row): Suggestion => ({
  id: r.id,
  blockId: r.block_id,
  authorId: r.author_id,
  proposed: r.proposed,
  baseText: r.base_text,
  note: r.note,
  status: r.status,
  createdAt: r.created_at,
});

export type ParagraphRef = { id: string; content: InlineNode[] };

/** Every paragraph in reading order — the blocks a reviewer can suggest text for. */
export function paragraphs(body: BodyNode[]): ParagraphRef[] {
  const out: ParagraphRef[] = [];
  const walk = (nodes: BodyNode[]) => {
    for (const node of nodes) {
      if (node.type === "paragraph") out.push({ id: node.id, content: node.content });
      else if (node.type === "section") walk(node.children);
    }
  };
  walk(body);
  return out;
}

/** Citations and cross-references shown as short readable markers. */
export function readable(tokenText: string): string {
  return tokenText.replace(/⟦C\d+⟧/g, "[cite]").replace(/⟦X\d+⟧/g, "[ref]");
}

/** The paragraph changed after the suggestion was made, so accepting would overwrite newer text. */
export function isStale(suggestion: Pick<Suggestion, "baseText">, current: InlineNode[] | undefined): boolean {
  return !current || inlineToTokenText(current).text !== suggestion.baseText;
}

export type DiffPart = { kind: "same" | "added" | "removed"; text: string };

/** Word-level diff (longest common subsequence) for showing a suggestion against the current text. */
export function diffWords(before: string, after: string): DiffPart[] {
  const a = before.split(/(\s+)/).filter(Boolean);
  const b = after.split(/(\s+)/).filter(Boolean);
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const parts: DiffPart[] = [];
  const push = (kind: DiffPart["kind"], text: string) => {
    const last = parts.at(-1);
    if (last?.kind === kind) last.text += text;
    else parts.push({ kind, text });
  };
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push("same", a[i]);
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) push("removed", a[i++]);
    else push("added", b[j++]);
  }
  while (i < a.length) push("removed", a[i++]);
  while (j < b.length) push("added", b[j++]);
  return parts;
}

export async function listSuggestions(documentId: string): Promise<Suggestion[]> {
  const { data, error } = await supabase
    .from("suggestions")
    .select(COLUMNS)
    .eq("document_id", documentId)
    .eq("status", "open")
    .order("created_at");
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map(fromRow);
}

/**
 * Stores a proposed rewrite of a paragraph. Citation markers the reviewer
 * kept map back to the original citations; none can be invented.
 */
export async function proposeEdit(documentId: string, paragraph: ParagraphRef, editedTokenText: string, note: string) {
  const { text: baseText, tokens } = inlineToTokenText(paragraph.content);
  const { content } = tokenTextToInline(editedTokenText, tokens);
  const { error } = await supabase.from("suggestions").insert({
    document_id: documentId,
    block_id: paragraph.id,
    proposed: content,
    base_text: baseText,
    note: note.trim() || null,
  });
  if (error) throw new Error(error.message);
}

export async function decideSuggestion(id: string, status: Exclude<SuggestionStatus, "open">) {
  const { error } = await supabase.from("suggestions").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}
