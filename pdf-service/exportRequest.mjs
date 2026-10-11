const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const MAX_BODY_BYTES = 4 * 1024;

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Reads a request body, refusing anything over `limit` bytes. */
export function readBody(req, limit = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new HttpError(413, "Request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/**
 * Both values end up in the URL the headless browser opens, so they must be
 * plain UUIDs — anything else could redirect the render to another page.
 */
export function parseExportRequest(raw) {
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new HttpError(400, "Body must be JSON");
  }
  const { documentId, token } = body ?? {};
  if (typeof documentId !== "string" || !UUID.test(documentId)) {
    throw new HttpError(400, "documentId must be a UUID");
  }
  if (typeof token !== "string" || !UUID.test(token)) {
    throw new HttpError(401, "A valid export token is required");
  }
  return { documentId, token };
}

/**
 * Confirms the export token is live before spending a Chromium launch on it.
 * Skipped (returns true) when Supabase isn't configured, e.g. local CLI use.
 */
export async function isExportTokenValid(token, env = process.env, fetchImpl = fetch) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_ANON_KEY;
  if (!url || !key) return true;
  const res = await fetchImpl(`${url.replace(/\/+$/, "")}/rest/v1/rpc/get_document_by_export_token`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ export_token: token }),
  });
  if (!res.ok) throw new Error(`Token check failed with status ${res.status}`);
  return (await res.json()) !== null;
}
