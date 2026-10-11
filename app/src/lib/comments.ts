import { supabase } from "../supabaseClient";
import type { BodyNode, InlineNode } from "../types/document";
import type { PaperRole, Person } from "./sharing";

export type Comment = {
  id: string;
  blockId: string | null;
  parentId: string | null;
  authorId: string | null;
  body: string;
  mentions: string[];
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Thread = { root: Comment; replies: Comment[]; lastActivity: string };
export type BlockAnchor = { id: string; label: string };

type Row = {
  id: string;
  block_id: string | null;
  parent_id: string | null;
  author_id: string | null;
  body: string;
  mentions: string[] | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

const COLUMNS = "id, block_id, parent_id, author_id, body, mentions, resolved_at, created_at, updated_at";

function fromRow(r: Row): Comment {
  return {
    id: r.id,
    blockId: r.block_id,
    parentId: r.parent_id,
    authorId: r.author_id,
    body: r.body,
    mentions: r.mentions ?? [],
    resolvedAt: r.resolved_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export const canComment = (role: PaperRole | null) => role === "owner" || role === "editor" || role === "reviewer";
export const canModerate = (role: PaperRole | null) => role === "owner" || role === "editor";

/** Threads with replies oldest-first; threads with the most recent activity first. */
export function groupThreads(comments: Comment[]): Thread[] {
  const replies = new Map<string, Comment[]>();
  for (const c of comments) {
    if (c.parentId) replies.set(c.parentId, [...(replies.get(c.parentId) ?? []), c]);
  }
  return comments
    .filter((c) => !c.parentId)
    .map((root) => {
      const thread = (replies.get(root.id) ?? []).toSorted((a, b) => a.createdAt.localeCompare(b.createdAt));
      const lastActivity = thread.at(-1)?.createdAt ?? root.createdAt;
      return { root, replies: thread, lastActivity };
    })
    .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));
}

/**
 * People named with @ in a comment: "@ada@uni.edu" or "@ada" (the part of
 * their email before the @). Only people on the paper can be mentioned.
 */
export function findMentions(body: string, people: Pick<Person, "userId" | "email">[]): string[] {
  const tokens = [...body.matchAll(/(?:^|\s)@([\w.+-]+(?:@[\w-]+(?:\.[\w-]+)+)?)/g)].map((m) => m[1].toLowerCase().replace(/\.$/, ""));
  const ids = new Set<string>();
  for (const token of tokens) {
    const match = people.find((p) => {
      const email = p.email.toLowerCase();
      return email === token || email.split("@")[0] === token;
    });
    if (match) ids.add(match.userId);
  }
  return [...ids];
}

function inlineText(nodes: InlineNode[]): string {
  return nodes
    .map((n) => (n.type === "text" ? n.text : ""))
    .join("")
    .trim();
}

function excerpt(text: string, max = 60): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** Body blocks a comment can be attached to, in reading order. */
export function commentAnchors(body: BodyNode[]): BlockAnchor[] {
  const anchors: BlockAnchor[] = [];
  function walk(nodes: BodyNode[]) {
    for (const node of nodes) {
      if (node.type === "section") {
        anchors.push({ id: node.id, label: `§ ${excerpt(node.heading || "Untitled section")}` });
        walk(node.children);
      } else if (node.type === "paragraph") {
        const text = inlineText(node.content);
        if (text) anchors.push({ id: node.id, label: `¶ ${excerpt(text)}` });
      } else if (node.type === "figure") {
        anchors.push({ id: node.id, label: `Figure: ${excerpt(inlineText(node.caption) || "untitled")}` });
      } else if (node.type === "table") {
        anchors.push({ id: node.id, label: `Table: ${excerpt(inlineText(node.caption) || "untitled")}` });
      } else if (node.type === "equation") {
        anchors.push({ id: node.id, label: "Equation" });
      }
    }
  }
  walk(body);
  return anchors;
}

export async function listComments(documentId: string): Promise<Comment[]> {
  const { data, error } = await supabase.from("comments").select(COLUMNS).eq("document_id", documentId).order("created_at");
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map(fromRow);
}

export async function addComment(
  documentId: string,
  input: { body: string; blockId?: string | null; parentId?: string | null; mentions?: string[] },
): Promise<Comment> {
  const { data, error } = await supabase
    .from("comments")
    .insert({
      document_id: documentId,
      body: input.body.trim(),
      block_id: input.blockId ?? null,
      parent_id: input.parentId ?? null,
      mentions: input.mentions ?? [],
    })
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return fromRow(data as Row);
}

export async function setResolved(id: string, resolved: boolean) {
  const { error } = await supabase
    .from("comments")
    .update({ resolved_at: resolved ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteComment(id: string) {
  const { error } = await supabase.from("comments").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
