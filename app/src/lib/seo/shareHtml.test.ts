import { describe, expect, it } from "vitest";
import { SHARE_BOT_PATTERN, buildShareHtml, escapeHtml, excerpt, previewFromContent } from "./shareHtml";

describe("previewFromContent", () => {
  it("prefers the title inside the document and excerpts the abstract", () => {
    const p = previewFromContent("Row title", {
      titleBlock: { title: [{ type: "text", text: "Deep " }, { type: "text", text: "Nets" }] },
      abstract: { text: "word ".repeat(80) },
    });
    expect(p.title).toBe("Deep Nets");
    expect(p.description.length).toBeLessThanOrEqual(200);
    expect(p.description.endsWith("…")).toBe(true);
  });

  it("falls back for missing or malformed content", () => {
    expect(previewFromContent(null, null)).toEqual({
      title: "Untitled paper",
      description: "An IEEE-formatted paper shared from IEEE Paper Builder.",
    });
    expect(previewFromContent("From row", { titleBlock: { title: "oops" as unknown as [] } }).title).toBe("From row");
  });
});

describe("buildShareHtml", () => {
  it("escapes user-controlled text in every tag", () => {
    const html = buildShareHtml({
      title: `"><script>alert(1)</script>`,
      description: "A & B",
      url: "https://example.org/view/1",
      image: "https://example.org/og-image.png",
      siteName: "IEEE Paper Builder",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&quot;&gt;&lt;script&gt;");
    expect(html).toContain('content="A &amp; B"');
    expect(html).toContain('<meta property="og:image" content="https://example.org/og-image.png">');
  });
});

describe("helpers", () => {
  it("escapeHtml handles quotes", () => expect(escapeHtml(`a'b"c`)).toBe("a&#39;b&quot;c"));
  it("excerpt leaves short text alone", () => expect(excerpt("  short   text ")).toBe("short text"));
  it("bot pattern matches common preview agents", () => {
    const re = new RegExp(`^${SHARE_BOT_PATTERN}$`);
    for (const ua of [
      "Slackbot-LinkExpanding 1.0",
      "WhatsApp/2.23",
      "facebookexternalhit/1.1",
      "Twitterbot/1.0",
      "LinkedInBot/1.0",
      "Mozilla/5.0 (compatible; Discordbot/2.0)",
    ]) {
      expect(re.test(ua)).toBe(true);
    }
    expect(re.test("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130")).toBe(false);
  });
});
