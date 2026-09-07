import type { ReferenceFields } from "./generateReferenceText";

/**
 * Looks up metadata for a given DOI using the public CrossRef API.
 * Automatically formats metadata into IEEE ReferenceFields.
 */
export async function lookupDoi(rawDoi: string): Promise<ReferenceFields> {
  const cleanDoi = rawDoi
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .trim();

  if (!cleanDoi) {
    throw new Error("Please enter a valid DOI (e.g. 10.1109/5.771073)");
  }

  const url = `https://api.crossref.org/works/${encodeURIComponent(cleanDoi)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      if (res.status === 404) {
        throw new Error(`DOI "${cleanDoi}" was not found in CrossRef.`);
      }
      throw new Error(`CrossRef API returned status ${res.status}`);
    }

    const json = await res.json();
    const work = json.message;

    // Authors formatting
    const authorsList = (work.author || []).map((a: { given?: string; family?: string; name?: string }) => {
      if (a.name) return a.name;
      const initials = (a.given || "")
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => `${part[0]}.`)
        .join(" ");
      return `${initials} ${a.family || ""}`.trim();
    });

    let authors = "";
    if (authorsList.length === 1) {
      authors = authorsList[0];
    } else if (authorsList.length === 2) {
      authors = `${authorsList[0]} and ${authorsList[1]}`;
    } else if (authorsList.length > 2) {
      authors = `${authorsList.slice(0, -1).join(", ")}, and ${authorsList[authorsList.length - 1]}`;
    }

    // Title
    const title = (work.title && work.title[0]) || "";

    // Venue / Container
    const venue =
      (work["container-title"] && work["container-title"][0]) ||
      work.publisher ||
      "";

    // Year
    const yearParts =
      work["published-print"]?.["date-parts"]?.[0] ||
      work["published-online"]?.["date-parts"]?.[0] ||
      work.issued?.["date-parts"]?.[0];
    const year = yearParts ? String(yearParts[0]) : "";

    // Volume & Pages
    const volume = work.volume || "";
    const pages = work.page || "";

    return {
      authors,
      title,
      venue,
      year,
      volume,
      pages,
    };
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.name === "AbortError") {
        throw new Error("DOI lookup timed out. Please try again.");
      }
      throw err;
    }
    throw new Error("An unexpected error occurred during DOI lookup.");
  } finally {
    clearTimeout(timeout);
  }
}
