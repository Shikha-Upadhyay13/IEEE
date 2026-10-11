export const MAX_BODY_BYTES = 1024 * 1024;
export const MAX_HISTORY = 40;
const MAX_MESSAGE_CHARS = 32_000;
const MAX_CONTEXT_CHARS = 200_000;
const MAX_INSTRUCTIONS_CHARS = 8_000;

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
        reject(new HttpError(413, "Request is too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function optionalText(value, max, name) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new HttpError(400, `${name} must be a string`);
  if (value.length > max) throw new HttpError(413, `${name} is too long`);
  return value;
}

/**
 * Only user and assistant turns are forwarded: the system prompt is ours, so a
 * client-supplied system message could otherwise override the guardrails.
 * Older turns beyond MAX_HISTORY are dropped rather than rejected.
 */
export function parseChatRequest(raw) {
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new HttpError(400, "Body must be JSON");
  }
  if (!body || !Array.isArray(body.messages)) {
    throw new HttpError(400, "messages (non-empty array) is required");
  }

  const messages = body.messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => {
      if (m.content.length > MAX_MESSAGE_CHARS) throw new HttpError(413, "A message is too long");
      return { role: m.role, content: m.content };
    })
    .slice(-MAX_HISTORY);
  if (messages.length === 0 || messages.at(-1).role !== "user") {
    throw new HttpError(400, "The last message must be from the user");
  }

  return {
    messages,
    documentContext: optionalText(body.documentContext, MAX_CONTEXT_CHARS, "documentContext"),
    projectInstructions: optionalText(body.projectInstructions, MAX_INSTRUCTIONS_CHARS, "projectInstructions"),
    task: typeof body.task === "string" ? body.task : undefined,
  };
}
