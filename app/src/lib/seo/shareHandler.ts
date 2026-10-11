// Explicit .js extension: this module is also compiled into the Vercel
// function (native Node ESM), which does not resolve extensionless imports.
import { buildShareHtml, previewFromContent } from "./shareHtml.js";

export type ShareEnv = {
  supabaseUrl?: string;
  anonKey?: string;
  siteUrl?: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SITE_NAME = "IEEE Paper Builder";

/**
 * Serves link-preview crawlers a tiny HTML page for /view/:id. Only papers
 * the owner made public are read (through the anon key, so row-level
 * security applies); anything else gets the generic preview, so private
 * titles never leak.
 */
export async function handleShareRequest(
  request: Request,
  env: ShareEnv,
  fetchImpl: typeof fetch = fetch
): Promise<Response> {
  const requestUrl = new URL(request.url);
  const id = requestUrl.searchParams.get("id") ?? "";
  const origin = (env.siteUrl || requestUrl.origin).replace(/\/+$/, "");
  const pageUrl = `${origin}/view/${encodeURIComponent(id)}`;

  let preview = { title: "Shared paper", description: "An IEEE-formatted paper shared from IEEE Paper Builder." };

  if (UUID.test(id) && env.supabaseUrl && env.anonKey) {
    try {
      const endpoint = `${env.supabaseUrl.replace(/\/+$/, "")}/rest/v1/rpc/get_shared_document`;
      const res = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          apikey: env.anonKey,
          Authorization: `Bearer ${env.anonKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ doc_id: id }),
      });
      if (res.ok) {
        // Anonymous callers only ever get shared papers back from this function.
        const rows = (await res.json()) as { title: string | null; content: unknown; is_public: boolean }[];
        const row = rows.find((r) => r.is_public);
        if (row) preview = previewFromContent(row.title, row.content);
      }
    } catch (err) {
      console.error("Share preview lookup failed:", err);
    }
  }

  const html = buildShareHtml({
    ...preview,
    url: pageUrl,
    image: `${origin}/og-image.png`,
    siteName: SITE_NAME,
  });
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=300",
    },
  });
}
