import { describe, expect, it } from "vitest";
import { describeViolation, handleCspReport, parseCspReports } from "./cspReport";

describe("parseCspReports", () => {
  it("reads the legacy report-uri shape", () => {
    const body = JSON.stringify({
      "csp-report": {
        "document-uri": "https://app.example.org/print/1?token=secret",
        "violated-directive": "script-src-elem",
        "effective-directive": "script-src-elem",
        "blocked-uri": "https://evil.example/x.js",
        "source-file": "https://app.example.org/assets/index.js",
        "line-number": 12,
      },
    });
    expect(parseCspReports(body)).toEqual([
      {
        directive: "script-src-elem",
        blocked: "https://evil.example/x.js",
        page: "https://app.example.org/print/1",
        source: "https://app.example.org/assets/index.js:12",
        disposition: "report",
      },
    ]);
  });

  it("reads Reporting API batches and ignores other report types", () => {
    const body = JSON.stringify([
      { type: "deprecation", body: { id: "x" } },
      { type: "csp-violation", body: { documentURL: "https://app.example.org/", effectiveDirective: "img-src", blockedURL: "http://insecure.example/a.png", disposition: "enforce" } },
    ]);
    expect(parseCspReports(body)).toEqual([
      { directive: "img-src", blocked: "http://insecure.example/a.png", page: "https://app.example.org/", source: undefined, disposition: "enforce" },
    ]);
  });

  it("returns nothing for malformed or oversized bodies", () => {
    expect(parseCspReports("not json")).toEqual([]);
    expect(parseCspReports(JSON.stringify({ other: 1 }))).toEqual([]);
    expect(parseCspReports(JSON.stringify({ "csp-report": { "blocked-uri": "x".repeat(20_000) } }))).toEqual([]);
  });
});

describe("handleCspReport", () => {
  it("logs one line per violation and answers 204", async () => {
    const lines: string[] = [];
    const body = JSON.stringify({ "csp-report": { "document-uri": "https://app.example.org/a", "effective-directive": "style-src-elem", "blocked-uri": "inline" } });
    const res = await handleCspReport(new Request("https://app.example.org/api/csp-report", { method: "POST", body }), (l) => lines.push(l));
    expect(res.status).toBe(204);
    expect(lines).toEqual(["[csp report] style-src-elem blocked inline on https://app.example.org/a"]);
    expect(describeViolation({ directive: "", blocked: "", page: "", disposition: "report" })).toBe("[csp report] unknown directive blocked inline on unknown page");
  });

  it("rejects other methods", async () => {
    const res = await handleCspReport(new Request("https://app.example.org/api/csp-report"));
    expect(res.status).toBe(405);
  });
});
