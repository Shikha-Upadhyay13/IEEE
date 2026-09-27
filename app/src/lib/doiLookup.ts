import type { ReferenceFields } from "./generateReferenceText";

export type CrossrefWork = {
  DOI?: string;
  title?: string[];
  author?: { given?: string; family?: string; name?: string }[];
  "container-title"?: string[];
  publisher?: string;
  volume?: string;
  page?: string;
  "published-print"?: { "date-parts"?: number[][] };
  "published-online"?: { "date-parts"?: number[][] };
  issued?: { "date-parts"?: number[][] };
};

const CROSSREF = "https://api.crossref.org/works";

export function cleanDoi(rawDoi: string): string {
  return rawDoi
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .trim();
}

async function crossrefFetch(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    return await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("CrossRef took too long to respond. Please try again.");
    }
    throw new Error("Couldn't reach CrossRef. Check your connection and try again.");
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchCrossrefWork(rawDoi: string): Promise<CrossrefWork> {
  const doi = cleanDoi(rawDoi);
  if (!doi) throw new Error("Please enter a valid DOI (e.g. 10.1109/5.771073)");
  const res = await crossrefFetch(`${CROSSREF}/${encodeURIComponent(doi)}`);
  if (res.status === 404) throw new Error(`DOI "${doi}" was not found in CrossRef.`);
  if (!res.ok) throw new Error(`CrossRef returned status ${res.status}.`);
  const json = await res.json();
  return json.message as CrossrefWork;
}

/** Top CrossRef matches for a free-text citation (title, authors, year). */
export async function searchCrossref(query: string, rows = 3): Promise<CrossrefWork[]> {
  const params = new URLSearchParams({ "query.bibliographic": query, rows: String(rows) });
  const res = await crossrefFetch(`${CROSSREF}?${params}`);
  if (!res.ok) throw new Error(`CrossRef returned status ${res.status}.`);
  const json = await res.json();
  return (json.message?.items ?? []) as CrossrefWork[];
}

export function workYear(work: CrossrefWork): string {
  const parts =
    work["published-print"]?.["date-parts"]?.[0] ??
    work["published-online"]?.["date-parts"]?.[0] ??
    work.issued?.["date-parts"]?.[0];
  return parts?.[0] ? String(parts[0]) : "";
}

export function workToFields(work: CrossrefWork): ReferenceFields {
  const authorsList = (work.author ?? []).map((a) => {
    if (a.name) return a.name;
    const initials = (a.given ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => `${part[0]}.`)
      .join(" ");
    return `${initials} ${a.family ?? ""}`.trim();
  });

  let authors = "";
  if (authorsList.length === 1) authors = authorsList[0];
  else if (authorsList.length === 2) authors = `${authorsList[0]} and ${authorsList[1]}`;
  else if (authorsList.length > 2) {
    authors = `${authorsList.slice(0, -1).join(", ")}, and ${authorsList[authorsList.length - 1]}`;
  }

  return {
    authors,
    title: work.title?.[0] ?? "",
    venue: work["container-title"]?.[0] || work.publisher || "",
    year: workYear(work),
    volume: work.volume ?? "",
    pages: work.page ?? "",
    ...(work.DOI ? { doi: work.DOI } : {}),
  };
}

/**
 * Looks up metadata for a given DOI using the public CrossRef API.
 * Automatically formats metadata into IEEE ReferenceFields.
 */
export async function lookupDoi(rawDoi: string): Promise<ReferenceFields> {
  const work = await fetchCrossrefWork(rawDoi);
  return { ...workToFields(work), doi: work.DOI ?? cleanDoi(rawDoi), verifiedAt: new Date().toISOString() };
}
