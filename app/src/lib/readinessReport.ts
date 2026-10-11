import type { Document } from "../types/document";
import { checklistSummary, type ChecklistItem, type ChecklistStatus } from "./checklist";
import { getFormat } from "./formats/formats";
import { MODES, getMode } from "./formats/modes";

const GROUPS: [ChecklistStatus, string][] = [
  ["fail", "Blockers"],
  ["warn", "Warnings"],
  ["info", "Notes"],
  ["pass", "Passed"],
];

/** True when a Submission-mode export should be refused. */
export function exportBlocked(doc: Pick<Document, "meta">, items: ChecklistItem[]): boolean {
  return getMode(doc.meta) === "submission" && items.some((i) => i.status === "fail");
}

/** Plain-text readiness report a co-author or advisor can read without the app. */
export function readinessReport(doc: Document, title: string, items: ChecklistItem[], now = new Date()): string {
  const summary = checklistSummary(items);
  const mode = MODES.find((m) => m.id === getMode(doc.meta))?.label ?? getMode(doc.meta);
  const verdict =
    summary.fail > 0
      ? `NOT READY — ${summary.fail} blocker${summary.fail === 1 ? "" : "s"} to fix`
      : summary.warn > 0
        ? `READY WITH WARNINGS — ${summary.warn} to review`
        : "READY";
  const lines = [
    "Submission readiness report",
    "===========================",
    "",
    `Paper:   ${title || "Untitled paper"}`,
    `Format:  ${getFormat(doc.meta).label} (${doc.meta.paperSize === "a4" ? "A4" : "US Letter"})`,
    `Mode:    ${mode}`,
    `Checked: ${now.toISOString().slice(0, 16).replace("T", " ")} UTC`,
    "",
    `Result:  ${verdict}`,
  ];
  for (const [status, heading] of GROUPS) {
    const group = items.filter((i) => i.status === status);
    if (group.length === 0) continue;
    const line = `${heading} (${group.length})`;
    lines.push("", line, "-".repeat(line.length));
    for (const item of group) lines.push(`- ${item.label}: ${item.detail}`);
  }
  lines.push(
    "",
    "These checks cover formatting and completeness. Always read the venue's call for papers for its own rules.",
    ""
  );
  return lines.join("\n");
}

export function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const a = window.document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
