import { describe, expect, it, vi } from "vitest";
import vercelConfig from "../../../vercel.json";
import { handleShareRequest } from "./shareHandler";
import { SHARE_BOT_PATTERN } from "./shareHtml";

const ID = "3f1c2b9a-1d2e-4f5a-8b7c-0123456789ab";
const env = { supabaseUrl: "https://proj.supabase.co", anonKey: "anon", siteUrl: "https://example.org" };

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

describe("handleShareRequest", () => {
  it("renders the public paper's title and abstract", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse([{ title: "Row", content: { titleBlock: { title: [{ text: "Graph Nets" }] }, abstract: { text: "We study graphs." } } }])
    );
    const res = await handleShareRequest(new Request(`https://example.org/api/share?id=${ID}`), env, fetchMock);
    const html = await res.text();
    expect(html).toContain('<meta property="og:title" content="Graph Nets">');
    expect(html).toContain('content="We study graphs."');
    expect(html).toContain(`<meta property="og:url" content="https://example.org/view/${ID}">`);
    const calledUrl = String((fetchMock.mock.calls[0] as unknown[])[0]);
    expect(calledUrl).toContain("is_public=eq.true");
  });

  it("never queries Supabase for malformed ids", async () => {
    const fetchMock = vi.fn();
    const res = await handleShareRequest(new Request("https://example.org/api/share?id=1%20or%201=1"), env, fetchMock);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await res.text()).toContain("Shared paper");
  });

  it("falls back to the generic preview for private or missing papers", async () => {
    const res = await handleShareRequest(new Request(`https://example.org/api/share?id=${ID}`), env, async () =>
      jsonResponse([])
    );
    expect(await res.text()).toContain('<meta property="og:title" content="Shared paper">');
  });
});

describe("vercel.json", () => {
  it("routes preview bots on /view/:id to the share function with the shared pattern", () => {
    const [rule, ...rest] = vercelConfig.rewrites;
    expect(rule.source).toBe("/view/:id");
    expect(rule.destination).toBe("/api/share?id=:id");
    expect(rule.has?.[0].value).toBe(SHARE_BOT_PATTERN);
    expect(rest.at(-1)?.destination).toBe("/index.html");
  });
});
