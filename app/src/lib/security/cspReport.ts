// Turns Content-Security-Policy violation reports into one short log line each.
// Browsers send either the legacy report-uri shape ({"csp-report": {...}})
// or the Reporting API shape ([{type: "csp-violation", body: {...}}]).

export interface CspViolation {
  directive: string;
  blocked: string;
  page: string;
  source?: string;
  disposition: string;
}

const MAX_BODY_BYTES = 16_384;
const MAX_REPORTS = 20;

type Raw = Record<string, unknown>;

const text = (value: unknown): string => (typeof value === "string" ? value : "");

/** Drops the query and fragment, which can carry share, export and unsubscribe tokens. */
export function stripUrl(value: string): string {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" || url.protocol === "wss:" ? `${url.origin}${url.pathname}` : url.protocol.replace(/:$/, "");
  } catch {
    return value.split(/[?#]/)[0].slice(0, 200);
  }
}

function fromLegacy(r: Raw): CspViolation {
  const line = r["line-number"];
  const file = stripUrl(text(r["source-file"]));
  return {
    directive: text(r["effective-directive"]) || text(r["violated-directive"]),
    blocked: stripUrl(text(r["blocked-uri"])),
    page: stripUrl(text(r["document-uri"])),
    source: file ? `${file}${typeof line === "number" ? `:${line}` : ""}` : undefined,
    disposition: text(r.disposition) || "report",
  };
}

function fromReportingApi(r: Raw): CspViolation {
  const line = r.lineNumber;
  const file = stripUrl(text(r.sourceFile));
  return {
    directive: text(r.effectiveDirective),
    blocked: stripUrl(text(r.blockedURL)),
    page: stripUrl(text(r.documentURL)),
    source: file ? `${file}${typeof line === "number" ? `:${line}` : ""}` : undefined,
    disposition: text(r.disposition) || "report",
  };
}

const isObject = (value: unknown): value is Raw => typeof value === "object" && value !== null && !Array.isArray(value);

/** Parses a report request body; returns no violations for anything malformed or oversized. */
export function parseCspReports(body: string): CspViolation[] {
  if (body.length > MAX_BODY_BYTES) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return [];
  }
  if (isObject(parsed) && isObject(parsed["csp-report"])) return [fromLegacy(parsed["csp-report"])];
  if (!Array.isArray(parsed)) return [];
  return parsed
    .slice(0, MAX_REPORTS)
    .filter((entry): entry is Raw => isObject(entry) && entry.type === "csp-violation" && isObject(entry.body))
    .map((entry) => fromReportingApi(entry.body as Raw));
}

export function describeViolation(v: CspViolation): string {
  return `[csp ${v.disposition}] ${v.directive || "unknown directive"} blocked ${v.blocked || "inline"} on ${v.page || "unknown page"}${v.source ? ` (${v.source})` : ""}`;
}

/** Handles POST /api/csp-report: logs each violation and always answers 204. */
export async function handleCspReport(request: Request, log: (line: string) => void = console.warn): Promise<Response> {
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } });
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared <= MAX_BODY_BYTES) {
    for (const violation of parseCspReports(await request.text())) log(describeViolation(violation));
  }
  return new Response(null, { status: 204 });
}
