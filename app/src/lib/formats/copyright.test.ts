import { describe, expect, it } from "vitest";
import { copyrightText, cssString, defaultCopyrightNotice } from "./copyright";
import { buildPageCss } from "./formats";

const notice = { variant: "ieee" as const, code: "979-8-3503-1234-5", year: "2026", price: "31.00" };

describe("copyrightText", () => {
  it("builds the standard IEEE line", () => {
    expect(copyrightText(notice)).toBe("979-8-3503-1234-5/26/$31.00 ©2026 IEEE");
  });

  it("supports the government and EU variants", () => {
    expect(copyrightText({ ...notice, variant: "us-gov" })).toBe("U.S. Government work not protected by U.S. copyright");
    expect(copyrightText({ ...notice, variant: "crown" })).toMatch(/©2026 Crown$/);
    expect(copyrightText({ ...notice, variant: "eu" })).toMatch(/©2026 European Union$/);
  });

  it("uses the conference's own text for custom", () => {
    expect(copyrightText({ ...notice, variant: "custom", text: " ©2026 ACME " })).toBe("©2026 ACME");
  });

  it("defaults to this year's IEEE line", () => {
    expect(defaultCopyrightNotice(new Date("2027-03-01")).year).toBe("2027");
  });
});

describe("page CSS", () => {
  it("puts the notice on the first page only, safely quoted", () => {
    const css = buildPageCss({
      template: "ieee-conference",
      paperSize: "letter",
      copyrightNotice: { ...notice, variant: "custom", text: 'He said "hi" \\ bye' },
    });
    expect(css).toContain('@page :first { @bottom-left { content: "He said \\"hi\\" \\\\ bye";');
  });

  it("is only printed on conference papers", () => {
    const css = buildPageCss({ template: "ieee-peer-review", paperSize: "letter", copyrightNotice: notice });
    expect(css).not.toContain("@page :first");
  });

  it("escapes newlines", () => {
    expect(cssString("a\nb")).toBe('"a b"');
  });
});
