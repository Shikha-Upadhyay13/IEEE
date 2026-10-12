import { describe, expect, it } from "vitest";
import { scrubDeep, scrubUrls, stripUrl } from "./urls";

describe("stripUrl", () => {
  it("keeps origin and path, dropping tokens in the query and fragment", () => {
    expect(stripUrl("https://app.example.org/unsubscribe?token=abc#x")).toBe("https://app.example.org/unsubscribe");
  });

  it("reduces non-web URLs and keywords to their scheme or name", () => {
    expect(stripUrl("data:image/png;base64,AAAA")).toBe("data");
    expect(stripUrl("inline")).toBe("inline");
  });
});

describe("scrubUrls", () => {
  it("strips queries from absolute URLs and paths inside text", () => {
    expect(scrubUrls("GET https://x.supabase.co/rest/v1/documents?id=eq.1 failed")).toBe("GET https://x.supabase.co/rest/v1/documents failed");
    expect(scrubUrls("navigated from /print/abc?token=secret to /dashboard#top")).toBe("navigated from /print/abc to /dashboard");
  });

  it("leaves text without URLs alone", () => {
    expect(scrubUrls("What? Why #1")).toBe("What? Why #1");
    expect(scrubUrls("a/b?c")).toBe("a/b?c");
  });
});

describe("scrubDeep", () => {
  it("scrubs every string in nested objects and arrays without mutating the input", () => {
    const event = { request: { url: "https://app.example.org/view/1?t=1" }, breadcrumbs: [{ data: { from: "/a?x=1", to: "/b", status: 200 } }] };
    expect(scrubDeep(event)).toEqual({ request: { url: "https://app.example.org/view/1" }, breadcrumbs: [{ data: { from: "/a", to: "/b", status: 200 } }] });
    expect(event.request.url).toBe("https://app.example.org/view/1?t=1");
  });
});
