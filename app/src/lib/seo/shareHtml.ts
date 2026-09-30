// Link-preview crawlers (Slack, WhatsApp, LinkedIn, X, Discord…) don't run
// JavaScript, so shared /view/:id links get this small server-rendered page
// carrying the paper's own title and abstract instead of the generic tags.

export type SharePreview = {
  title: string;
  description: string;
  url: string;
  image: string;
  siteName: string;
};

// Case-sensitive on purpose (vercel.json header matching has no flags):
// "bot"/"Bot" covers Slackbot, Twitterbot, LinkedInBot, Discordbot, TelegramBot, Googlebot.
export const SHARE_BOT_PATTERN =
  ".*(bot|Bot|BOT|crawler|spider|facebookexternalhit|WhatsApp|Embedly|SkypeUriPreview|Pinterest|vkShare|Quora Link Preview).*";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function excerpt(text: string, max = 200): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:]+$/, "")}…`;
}

type InlineLike = { type?: string; text?: string };

/** Pulls a plain title and abstract out of a stored document's JSON, tolerating partial data. */
export function previewFromContent(
  rowTitle: string | null | undefined,
  content: unknown
): { title: string; description: string } {
  const doc = (content ?? {}) as {
    titleBlock?: { title?: InlineLike[] };
    abstract?: { text?: string };
  };
  const titleNodes = Array.isArray(doc.titleBlock?.title) ? doc.titleBlock.title : [];
  const titleFromContent = titleNodes
    .map((n) => (typeof n?.text === "string" ? n.text : ""))
    .join("")
    .trim();
  const title = titleFromContent || rowTitle?.trim() || "Untitled paper";
  const abstract = typeof doc.abstract?.text === "string" ? doc.abstract.text : "";
  return {
    title,
    description: abstract.trim() ? excerpt(abstract) : "An IEEE-formatted paper shared from IEEE Paper Builder.",
  };
}

export function buildShareHtml(p: SharePreview): string {
  const t = escapeHtml(p.title);
  const d = escapeHtml(p.description);
  const u = escapeHtml(p.url);
  const i = escapeHtml(p.image);
  const s = escapeHtml(p.siteName);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${t} · ${s}</title>
<meta name="description" content="${d}">
<meta name="robots" content="noindex">
<link rel="canonical" href="${u}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="${s}">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:url" content="${u}">
<meta property="og:image" content="${i}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="twitter:image" content="${i}">
</head>
<body>
<h1>${t}</h1>
<p>${d}</p>
<p><a href="${u}">Read the paper</a></p>
</body>
</html>
`;
}
