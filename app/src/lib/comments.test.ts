import { describe, expect, it, vi } from "vitest";

vi.mock("../supabaseClient", () => ({ supabase: {} }));

import { commentAnchors, findMentions, groupThreads, type Comment } from "./comments";
import type { BodyNode } from "../types/document";

const comment = (id: string, createdAt: string, parentId: string | null = null): Comment => ({
  id,
  blockId: null,
  parentId,
  authorId: "u",
  body: id,
  mentions: [],
  resolvedAt: null,
  createdAt,
  updatedAt: createdAt,
});

describe("groupThreads", () => {
  it("nests replies oldest-first and orders threads by latest activity", () => {
    const threads = groupThreads([
      comment("old", "2026-01-01T01:00:00Z"),
      comment("new", "2026-01-01T02:00:00Z"),
      comment("reply-2", "2026-01-01T04:00:00Z", "old"),
      comment("reply-1", "2026-01-01T03:00:00Z", "old"),
    ]);
    expect(threads.map((t) => t.root.id)).toEqual(["old", "new"]);
    expect(threads[0].replies.map((r) => r.id)).toEqual(["reply-1", "reply-2"]);
    expect(threads[0].lastActivity).toBe("2026-01-01T04:00:00Z");
  });
});

describe("findMentions", () => {
  const people = [
    { userId: "a", email: "Ada@uni.edu" },
    { userId: "b", email: "bob@lab.org" },
  ];

  it("matches full emails and the part before the @", () => {
    expect(findMentions("@ada please check, cc @bob@lab.org.", people)).toEqual(["a", "b"]);
  });

  it("ignores strangers, repeats and emails written inline", () => {
    expect(findMentions("@carol and @ada and @ada; mail ada@uni.edu", people)).toEqual(["a"]);
  });
});

describe("commentAnchors", () => {
  it("lists sections, non-empty paragraphs and floats in reading order", () => {
    const body: BodyNode[] = [
      {
        type: "section",
        id: "s1",
        heading: "Introduction",
        level: 1,
        children: [
          { type: "paragraph", id: "p1", content: [{ type: "text", text: "Deep learning has transformed vision." }] },
          { type: "paragraph", id: "p2", content: [] },
        ],
      },
    ];
    expect(commentAnchors(body)).toEqual([
      { id: "s1", label: "§ Introduction" },
      { id: "p1", label: "¶ Deep learning has transformed vision." },
    ]);
  });
});
