// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createSamplePaper } from "../../data/samplePaper";
import { useDocumentStore } from "../../store/documentStore";
import { createSnapshot } from "../../lib/versions";
import { FormatPanel } from "./FormatPanel";

vi.mock("../../supabaseClient", () => ({ supabase: {} }));
vi.mock("../../lib/useAuth", () => ({ useAuth: () => ({ session: null, user: { id: "user-1" }, loading: false }) }));
vi.mock("../../lib/versions", () => ({ createSnapshot: vi.fn() }));
const snapshot = vi.mocked(createSnapshot);

beforeEach(() => {
  const document = createSamplePaper();
  document.meta = { ...document.meta, mode: "submission" };
  useDocumentStore.setState({ document, documentId: "paper-1" });
  snapshot.mockReset();
  snapshot.mockResolvedValue({ error: null });
});

afterEach(cleanup);

const template = () => useDocumentStore.getState().document.meta.template;

describe("FormatPanel", { timeout: 20_000 }, () => {
  it("saves a snapshot before switching format", async () => {
    const user = userEvent.setup();
    render(<FormatPanel />);

    await user.selectOptions(screen.getByLabelText("Format"), "ieee-journal");
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Switch to IEEE Journal / Transactions?");
    await user.click(screen.getByRole("button", { name: "Switch format" }));

    expect(snapshot).toHaveBeenCalledWith("paper-1", "Before switching to IEEE Journal / Transactions", expect.objectContaining({ meta: expect.objectContaining({ template: "ieee-conference" }) }));
    expect(template()).toBe("ieee-journal");
    expect(screen.getByLabelText("Format")).toHaveValue("ieee-journal");
  });

  it("leaves the format alone when the switch is cancelled", async () => {
    const user = userEvent.setup();
    render(<FormatPanel />);

    await user.selectOptions(screen.getByLabelText("Format"), "ieee-technote");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(snapshot).not.toHaveBeenCalled();
    expect(template()).toBe("ieee-conference");
  });

  it("refuses to switch when the snapshot can't be saved", async () => {
    snapshot.mockResolvedValue({ error: new Error("Failed to fetch") });
    const user = userEvent.setup();
    render(<FormatPanel />);

    await user.selectOptions(screen.getByLabelText("Format"), "ieee-peer-review");
    await user.click(screen.getByRole("button", { name: "Switch format" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't save a snapshot, so the format wasn't changed.");
    expect(template()).toBe("ieee-conference");
  });

  it("locks the font in Submission mode and frees it in Custom", async () => {
    const user = userEvent.setup();
    render(<FormatPanel />);

    expect(screen.getByLabelText("Font")).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: "Custom" }));
    expect(screen.getByRole("radio", { name: "Custom" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByLabelText("Font")).toBeEnabled();
    expect(screen.getByText("This paper is not IEEE-compliant while in Custom mode.")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Font"), "arial");
    expect(useDocumentStore.getState().document.meta.fontFamily).toBe("arial");
  });

  it("offers journal fields only for journal formats", async () => {
    const user = userEvent.setup();
    const { container } = render(<FormatPanel />);
    const before = container.querySelectorAll("input, select, textarea").length;

    await user.selectOptions(screen.getByLabelText("Format"), "ieee-journal");
    await user.click(screen.getByRole("button", { name: "Switch format" }));

    expect(container.querySelectorAll("input, select, textarea").length).toBeGreaterThan(before);
  });
});
