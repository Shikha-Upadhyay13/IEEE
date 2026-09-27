import type { InlineNode } from "../types/document";

const TOKEN_RE = /⟦([CX]\d+)⟧/g;

export type TokenizedText = {
  text: string;
  tokens: Map<string, InlineNode>;
  hadFormatting: boolean;
};

/** Plain text for the model, with citations and cross-references as ⟦C1⟧ / ⟦X1⟧ placeholders. */
export function inlineToTokenText(content: InlineNode[]): TokenizedText {
  const tokens = new Map<string, InlineNode>();
  let cites = 0;
  let xrefs = 0;
  let hadFormatting = false;
  const text = content
    .map((node) => {
      if (node.type === "text") {
        if (node.bold || node.italic || node.superscript) hadFormatting = true;
        return node.text;
      }
      const key = node.type === "citeRef" ? `C${++cites}` : `X${++xrefs}`;
      tokens.set(key, node);
      return `⟦${key}⟧`;
    })
    .join("");
  return { text, tokens, hadFormatting };
}

export type DetokenizeResult = {
  content: InlineNode[];
  /** Tokens the model returned that were never in the original (removed). */
  invented: string[];
  /** Original tokens the model dropped (re-attached at the end). */
  missing: string[];
  /** Bracketed numbers like [4] that look like invented citations (removed). */
  strayCitations: string[];
};

// "[3]", "[2, 5]", "[4], [5]-[7]" — IEEE-style numeric citations typed as text.
const STRAY_CITATION_RE = /\s?\[\d+(?:\s*[,–-]\s*\d+)*\](?:\s*[,–-]\s*\[\d+(?:\s*[,–-]\s*\d+)*\])*/g;

function normalizeSpaces(text: string): string {
  return text
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([.,;:])/g, "$1")
    .replace(/,([.;:])/g, "$1");
}

/**
 * Turns model output back into inline nodes. Only placeholders that came from
 * the original paragraph survive, so the model can never introduce a citation.
 */
export function tokenTextToInline(raw: string, tokens: Map<string, InlineNode>): DetokenizeResult {
  const invented: string[] = [];
  const strayCitations: string[] = [];
  const used = new Set<string>();

  let text = raw.trim().replace(/^["“]|["”]$/g, "");
  text = text.replace(STRAY_CITATION_RE, (match) => {
    strayCitations.push(match.trim());
    return "";
  });

  const content: InlineNode[] = [];
  let last = 0;
  const pushText = (s: string) => {
    if (!s) return;
    const prev = content[content.length - 1];
    if (prev?.type === "text") prev.text += s;
    else content.push({ type: "text", text: s });
  };

  for (const match of text.matchAll(TOKEN_RE)) {
    const key = match[1];
    pushText(text.slice(last, match.index));
    last = (match.index ?? 0) + match[0].length;
    const node = tokens.get(key);
    if (node && !used.has(key)) {
      used.add(key);
      content.push(node);
    } else if (!node) {
      invented.push(key);
    }
  }
  pushText(text.slice(last));

  const missing = [...tokens.keys()].filter((k) => !used.has(k));
  for (const key of missing) {
    const node = tokens.get(key);
    if (!node) continue;
    pushText(" ");
    content.push(node);
  }

  for (const node of content) {
    if (node.type === "text") node.text = normalizeSpaces(node.text);
  }
  return { content: content.filter((n) => n.type !== "text" || n.text !== ""), invented, missing, strayCitations };
}
