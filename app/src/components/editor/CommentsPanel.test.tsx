// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createSamplePaper } from "../../data/samplePaper";
import { addComment, deleteComment, listComments, setResolved, type Comment } from "../../lib/comments";
import { listPeople } from "../../lib/sharing";
import { CommentsPanel } from "./CommentsPanel";

vi.mock("../../supabaseClient", () => ({ supabase: {} }));
vi.mock("../../lib/comments", async (importActual) => ({
  ...(await importActual<typeof import("../../lib/comments")>()),
  listComments: vi.fn(),
  addComment: vi.fn(),
  deleteComment: vi.fn(),
  setResolved: vi.fn(),
}));
vi.mock("../../lib/sharing", async (importActual) => ({
  ...(await importActual<typeof import("../../lib/sharing")>()),
  listPeople: vi.fn(),
}));

const ME = "user-me";
const COAUTHOR = "user-co";
const body = createSamplePaper().body;
const now = new Date().toISOString();

const comment = (over: Partial<Comment>): Comment => ({
  id: "c1",
  blockId: null,
  parentId: null,
  authorId: COAUTHOR,
  body: "Please tighten the abstract.",
  mentions: [],
  resolvedAt: null,
  createdAt: now,
  updatedAt: now,
  ...over,
});

let stored: Comment[];

beforeEach(() => {
  stored = [comment({})];
  vi.mocked(listComments).mockImplementation(async () => stored);
  vi.mocked(listPeople).mockResolvedValue([
    { userId: ME, email: "me@uni.edu", role: "owner" },
    { userId: COAUTHOR, email: "ada@uni.edu", role: "editor" },
  ]);
  vi.mocked(addComment).mockImplementation(async (_doc, input) => {
    stored = [...stored, comment({ id: `c${stored.length + 1}`, authorId: ME, body: input.body, blockId: input.blockId ?? null, parentId: input.parentId ?? null })];
    return stored.at(-1)!;
  });
  vi.mocked(setResolved).mockImplementation(async (id, resolved) => {
    stored = stored.map((c) => (c.id === id ? { ...c, resolvedAt: resolved ? now : null } : c));
  });
  vi.mocked(deleteComment).mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const renderPanel = (role: "owner" | "editor" | "reviewer" | "viewer" = "owner") =>
  render(<CommentsPanel documentId="paper-1" body={body} role={role} userId={null} isOpen onClose={() => {}} />);

describe("CommentsPanel", { timeout: 20_000 }, () => {
  it("lists open threads with their author", async () => {
    renderPanel();
    expect(await screen.findByText("Please tighten the abstract.")).toBeInTheDocument();
    expect(screen.getByText("ada@uni.edu")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Open (1)" })).toHaveAttribute("aria-selected", "true");
  });

  it("posts a comment anchored to a section, with mentions resolved to people", async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText("ada@uni.edu");

    await user.selectOptions(screen.getByLabelText("What this comment is about"), "sec-intro");
    await user.type(screen.getByLabelText("New comment"), "@ada can you check this?");
    await user.click(screen.getByRole("button", { name: "Comment" }));

    expect(addComment).toHaveBeenCalledWith("paper-1", { body: "@ada can you check this?", blockId: "sec-intro", mentions: [COAUTHOR] });
    expect(await screen.findByText("@ada can you check this?")).toBeInTheDocument();
    expect(screen.getByLabelText("New comment")).toHaveValue("");
  });

  it("replies inside a thread", async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText("ada@uni.edu");

    await user.type(screen.getByLabelText("Reply to this thread"), "Done.");
    await user.click(screen.getByRole("button", { name: "Reply" }));

    expect(addComment).toHaveBeenCalledWith("paper-1", { body: "Done.", blockId: null, parentId: "c1", mentions: [] });
  });

  it("moves a resolved thread to the Resolved tab", async () => {
    const user = userEvent.setup();
    renderPanel();
    await screen.findByText("ada@uni.edu");

    await user.click(screen.getByRole("button", { name: "Resolve" }));

    expect(setResolved).toHaveBeenCalledWith("c1", true);
    expect(await screen.findByText("No open comments. Start a thread above.")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Resolved (1)" }));
    expect(screen.getByText("Please tighten the abstract.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reopen" })).toBeInTheDocument();
  });

  it("is read-only for viewers", async () => {
    renderPanel("viewer");
    await screen.findByText("ada@uni.edu");

    expect(screen.queryByLabelText("New comment")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Reply to this thread")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resolve" })).not.toBeInTheDocument();
  });

  it("shows why a comment failed and keeps the draft", async () => {
    vi.mocked(addComment).mockRejectedValue(new Error("Failed to fetch"));
    const user = userEvent.setup();
    renderPanel("reviewer");
    await screen.findByText("ada@uni.edu");

    await user.type(screen.getByLabelText("New comment"), "Typo in Fig. 1");
    await user.click(screen.getByRole("button", { name: "Comment" }));

    expect(await screen.findByRole("alert")).not.toBeEmptyDOMElement();
    expect(screen.getByLabelText("New comment")).toHaveValue("Typo in Fig. 1");
  });

  it("lets the author's own thread be resolved by a reviewer but not someone else's", async () => {
    stored = [comment({}), comment({ id: "c2", authorId: ME, body: "My own note" })];
    render(<CommentsPanel documentId="paper-1" body={body} role="reviewer" userId={ME} isOpen onClose={() => {}} />);
    const mine = (await screen.findByText("My own note")).closest("div.rounded-xl") as HTMLElement;
    const theirs = screen.getByText("Please tighten the abstract.").closest("div.rounded-xl") as HTMLElement;

    expect(within(mine).getByRole("button", { name: "Resolve" })).toBeInTheDocument();
    expect(within(theirs).queryByRole("button", { name: "Resolve" })).not.toBeInTheDocument();
  });
});
