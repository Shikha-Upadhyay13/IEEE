// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createSamplePaper } from "../../data/samplePaper";
import { useDocumentStore } from "../../store/documentStore";
import type { ChecklistItem } from "../../lib/checklist";
import { ChecklistPanel } from "./ChecklistPanel";

const fixReferencePageRanges = vi.fn();

beforeEach(() => {
  useDocumentStore.setState({ document: createSamplePaper(), fixReferencePageRanges });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const items: ChecklistItem[] = [
  { id: "title", label: "Title", status: "pass", detail: "Looks good.", target: { kind: "details" } },
  { id: "abstract", label: "Abstract length", status: "fail", detail: "Over 150 words.", target: { kind: "details" } },
  { id: "intro", label: "Empty paragraph", status: "warn", detail: "A paragraph has no text.", target: { kind: "block", id: "p-intro-1" } },
  {
    id: "ranges",
    label: "Page ranges",
    status: "warn",
    detail: "Use en dashes in page ranges.",
    target: { kind: "references" },
    fix: { id: "page-range-dashes", label: "Fix page ranges" },
  },
];

describe("ChecklistPanel", { timeout: 20_000 }, () => {
  it("counts blockers and warnings on the button", () => {
    render(<ChecklistPanel items={items} onNavigate={() => {}} />);
    expect(screen.getByRole("button", { name: /Checklist/ })).toHaveTextContent("3");
  });

  it("shows a pass mark when nothing is outstanding", () => {
    render(<ChecklistPanel items={[items[0]]} onNavigate={() => {}} />);
    expect(screen.getByLabelText("All checks pass")).toBeInTheDocument();
  });

  it("summarises and jumps to the section that holds a flagged block", async () => {
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    render(<ChecklistPanel items={items} onNavigate={onNavigate} />);

    await user.click(screen.getByRole("button", { name: /Checklist/ }));
    expect(screen.getByText("1 blocker, 2 warnings. Click an item to jump to it.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Empty paragraph/ }));
    expect(onNavigate).toHaveBeenCalledWith({ kind: "section", id: "sec-intro" }, "p-intro-1");
    expect(screen.queryByText("Submission checklist")).not.toBeInTheDocument();
  });

  it("does not offer navigation for passing checks", async () => {
    const user = userEvent.setup();
    render(<ChecklistPanel items={items} onNavigate={() => {}} />);
    await user.click(screen.getByRole("button", { name: /Checklist/ }));

    expect(screen.queryByRole("button", { name: /^Passed Title/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Abstract length/ })).toBeInTheDocument();
  });

  it("applies a safe automatic fix", async () => {
    const user = userEvent.setup();
    render(<ChecklistPanel items={items} onNavigate={() => {}} />);
    await user.click(screen.getByRole("button", { name: /Checklist/ }));

    await user.click(screen.getByRole("button", { name: "Fix page ranges" }));
    expect(fixReferencePageRanges).toHaveBeenCalledOnce();
  });
});
