import { describe, expect, it } from "vitest";
import { PUBLIC_ROUTES, buildRobots, buildSitemap, formatPageTitle, normalizeSiteUrl } from "./publicRoutes";

describe("formatPageTitle", () => {
  it("appends the site name once", () => {
    expect(formatPageTitle("Sign in")).toBe("Sign in · IEEE Paper Builder");
    expect(formatPageTitle("IEEE Paper Builder — editor")).toBe("IEEE Paper Builder — editor");
    expect(formatPageTitle()).toBe("IEEE Paper Builder");
  });
});

describe("buildSitemap", () => {
  it("lists every public route with absolute URLs", () => {
    const xml = buildSitemap("https://example.org/", PUBLIC_ROUTES, "2026-09-30");
    for (const r of PUBLIC_ROUTES) expect(xml).toContain(`<loc>https://example.org${r.path}</loc>`);
    expect(xml).toContain("<lastmod>2026-09-30</lastmod>");
    expect(xml.startsWith('<?xml version="1.0"')).toBe(true);
  });

  it("escapes XML special characters", () => {
    const xml = buildSitemap("https://example.org", [
      { path: "/a?b=1&c=2", title: "", description: "", changefreq: "yearly", priority: 0.5 },
    ]);
    expect(xml).toContain("/a?b=1&amp;c=2");
  });
});

describe("buildRobots", () => {
  it("blocks signed-in routes and points at the sitemap", () => {
    const robots = buildRobots("https://example.org/");
    expect(robots).toContain("Disallow: /editor/");
    expect(robots).toContain("Disallow: /print/");
    expect(robots).toContain("Sitemap: https://example.org/sitemap.xml");
  });
});

describe("normalizeSiteUrl", () => {
  it("strips trailing slashes and whitespace", () => {
    expect(normalizeSiteUrl(" https://example.org// ")).toBe("https://example.org");
  });
});
