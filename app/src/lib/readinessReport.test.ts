import { describe, expect, it } from "vitest";
import { exportBlocked, readinessReport } from "./readinessReport";
import type { ChecklistItem } from "./checklist";
import type { Document } from "../types/document";

const meta = (mode: "submission" | "draft"): Document["meta"] => ({
  template: "ieee-conference",
  paperSize: "letter",
  pageLimit: 6,
  mode,
});
const blocker: ChecklistItem = { id: "title", label: "Title", status: "fail", detail: "Add a title to your paper." };
const ok: ChecklistItem = { id: "keywords", label: "Keywords", status: "pass", detail: "3 keywords." };

describe("exportBlocked", () => {
  it("blocks Submission-mode exports with blockers only", () => {
    expect(exportBlocked({ meta: meta("submission") }, [blocker, ok])).toBe(true);
    expect(exportBlocked({ meta: meta("submission") }, [ok])).toBe(false);
    expect(exportBlocked({ meta: meta("draft") }, [blocker])).toBe(false);
  });
});

describe("readinessReport", () => {
  it("lists the verdict and groups items by severity", () => {
    const doc = { meta: meta("submission") } as Document;
    const report = readinessReport(doc, "My Paper", [ok, blocker], new Date("2026-10-11T10:00:00Z"));
    expect(report).toContain("Paper:   My Paper");
    expect(report).toContain("Mode:    IEEE Submission");
    expect(report).toContain("Result:  NOT READY — 1 blocker to fix");
    expect(report).toContain("Checked: 2026-10-11 10:00 UTC");
    expect(report.indexOf("Blockers (1)")).toBeLessThan(report.indexOf("Passed (1)"));
    expect(report).toContain("- Title: Add a title to your paper.");
  });
});
