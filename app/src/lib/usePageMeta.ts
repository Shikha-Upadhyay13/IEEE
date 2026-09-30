import { useEffect } from "react";
import { DEFAULT_DESCRIPTION, formatPageTitle, normalizeSiteUrl } from "./seo/publicRoutes";

type PageMeta = {
  title?: string;
  description?: string;
  /** Private or per-user pages should not be indexed. */
  noindex?: boolean;
};

function setMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

function setCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.rel = "canonical";
    document.head.appendChild(el);
  }
  el.href = href;
}

export function usePageMeta({ title, description, noindex = false }: PageMeta) {
  useEffect(() => {
    const fullTitle = formatPageTitle(title);
    const desc = description ?? DEFAULT_DESCRIPTION;
    const origin = normalizeSiteUrl(import.meta.env.VITE_SITE_URL ?? window.location.origin);
    const url = `${origin}${window.location.pathname}`;

    document.title = fullTitle;
    setMeta("name", "description", desc);
    setMeta("property", "og:title", fullTitle);
    setMeta("property", "og:description", desc);
    setMeta("property", "og:url", url);
    setMeta("name", "twitter:title", fullTitle);
    setMeta("name", "twitter:description", desc);
    setMeta("name", "robots", noindex ? "noindex, nofollow" : "index, follow");
    setCanonical(url);
  }, [title, description, noindex]);
}
