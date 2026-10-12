// Share, export and unsubscribe links carry tokens in the query string or
// fragment, so anything sent to logs or monitoring keeps only origin and path.

/** Drops the query and fragment of one URL; non-web URLs reduce to their scheme. */
export function stripUrl(value: string): string {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" || url.protocol === "wss:" ? `${url.origin}${url.pathname}` : url.protocol.replace(/:$/, "");
  } catch {
    return value.split(/[?#]/)[0].slice(0, 200);
  }
}

const URL_WITH_QUERY = /((?:https?|wss?):\/\/[^\s?#"'<>]+|(?<![\w:/])\/[^\s?#"'<>]*)[?#][^\s"'<>]*/g;

/** Strips the query and fragment from every absolute URL or root-relative path inside `text`. */
export function scrubUrls(text: string): string {
  return text.replace(URL_WITH_QUERY, "$1");
}

/** Returns a copy of `value` with `scrubUrls` applied to every string inside it. */
export function scrubDeep<T>(value: T, depth = 0): T {
  if (typeof value === "string") return scrubUrls(value) as T;
  if (depth > 8 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => scrubDeep(item, depth + 1)) as T;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) out[key] = scrubDeep(item, depth + 1);
  return out as T;
}
