export const SITE_NAME = "IEEE Paper Builder";

export const DEFAULT_DESCRIPTION =
  "Write IEEE conference papers in a drag-and-drop editor with a live two-column preview. Formatting, numbering and citations are handled for you — no LaTeX required.";

export type PublicRoute = {
  path: string;
  title: string;
  description: string;
  changefreq: "daily" | "weekly" | "monthly" | "yearly";
  priority: number;
};

/** Every indexable page. Drives per-route meta tags and sitemap.xml. */
export const PUBLIC_ROUTES: PublicRoute[] = [
  {
    path: "/",
    title: "IEEE Paper Builder — IEEE conference paper editor, no LaTeX",
    description: DEFAULT_DESCRIPTION,
    changefreq: "weekly",
    priority: 1,
  },
  {
    path: "/templates",
    title: "IEEE Paper Templates — research, survey, experimental, project report",
    description:
      "Free IEEE conference paper templates for research papers, surveys, experimental papers and project reports. Edit online, export a PDF.",
    changefreq: "monthly",
    priority: 0.9,
  },
  {
    path: "/guides",
    title: "Free IEEE formatting tools",
    description:
      "Free browser tools for IEEE papers: reference formatter, BibTeX to IEEE converter and abstract word counter. No account needed.",
    changefreq: "monthly",
    priority: 0.8,
  },
  {
    path: "/guides/ieee-reference-format",
    title: "IEEE Reference Formatter — free IEEE citation generator",
    description:
      "Format journal and conference references in IEEE style from a DOI or by hand, with author initials and punctuation done right.",
    changefreq: "monthly",
    priority: 0.8,
  },
  {
    path: "/guides/bibtex-to-ieee",
    title: "BibTeX to IEEE Converter — free, in your browser",
    description:
      "Paste BibTeX from Google Scholar, Zotero or a .bib file and get a numbered IEEE reference list. Nothing is uploaded.",
    changefreq: "monthly",
    priority: 0.8,
  },
  {
    path: "/guides/ieee-abstract-word-count",
    title: "IEEE Abstract Word Counter — check the 150–250 word limit",
    description:
      "Count your abstract's words against IEEE limits and catch citations, equations and figure references that don't belong.",
    changefreq: "monthly",
    priority: 0.8,
  },
  {
    path: "/login",
    title: "Sign in",
    description: "Sign in or create a free account to start writing your IEEE conference paper.",
    changefreq: "yearly",
    priority: 0.3,
  },
  {
    path: "/terms",
    title: "Terms of Service",
    description: "The terms that apply when you use IEEE Paper Builder.",
    changefreq: "yearly",
    priority: 0.1,
  },
  {
    path: "/privacy",
    title: "Privacy Policy",
    description: "What IEEE Paper Builder stores, why, and how to export or delete your data.",
    changefreq: "yearly",
    priority: 0.1,
  },
];

/** Signed-in and machine-only routes crawlers should skip. */
export const DISALLOWED_PREFIXES = [
  "/dashboard",
  "/editor/",
  "/assistant",
  "/profile",
  "/settings",
  "/downloads",
  "/print/",
  "/reset-password",
];

export function findPublicRoute(path: string): PublicRoute | undefined {
  return PUBLIC_ROUTES.find((r) => r.path === path);
}

export function formatPageTitle(title?: string): string {
  if (!title) return SITE_NAME;
  return title.includes(SITE_NAME) ? title : `${title} · ${SITE_NAME}`;
}

export function normalizeSiteUrl(siteUrl: string): string {
  return siteUrl.trim().replace(/\/+$/, "");
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function buildSitemap(siteUrl: string, routes: PublicRoute[] = PUBLIC_ROUTES, lastmod?: string): string {
  const base = normalizeSiteUrl(siteUrl);
  const urls = routes
    .map((r) =>
      [
        "  <url>",
        `    <loc>${escapeXml(base + r.path)}</loc>`,
        lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
        `    <changefreq>${r.changefreq}</changefreq>`,
        `    <priority>${r.priority.toFixed(1)}</priority>`,
        "  </url>",
      ]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function buildRobots(siteUrl: string): string {
  const lines = ["User-agent: *", "Allow: /", ...DISALLOWED_PREFIXES.map((p) => `Disallow: ${p}`), ""];
  lines.push(`Sitemap: ${normalizeSiteUrl(siteUrl)}/sitemap.xml`, "");
  return lines.join("\n");
}
