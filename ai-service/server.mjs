import http from "node:http";
import { streamChat } from "./groqClient.mjs";

const PORT = process.env.PORT ?? 3002;
// Dev-only permissive CORS, same rationale as pdf-service/server.mjs — fine
// for a solo-student local setup; tighten to an explicit allowlist before
// any real deployment.
const ORIGIN = process.env.FRONTEND_ORIGIN ?? "http://localhost:3000";

// ─── Rate Limiting ──────────────────────────────────────────────────────────
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_PER_MINUTE ?? "20", 10);
const ipRequestCounts = new Map();

// Periodic prune to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of ipRequestCounts.entries()) {
    if (now > record.resetTime) {
      ipRequestCounts.delete(ip);
    }
  }
}, 5 * 60 * 1000).unref();

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "127.0.0.1";
}

function checkRateLimit(ip) {
  const now = Date.now();
  let record = ipRequestCounts.get(ip);
  if (!record || now > record.resetTime) {
    record = { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS };
    ipRequestCounts.set(ip, record);
    return { limited: false, remaining: RATE_LIMIT_MAX_REQUESTS - 1, resetInSeconds: 60 };
  }
  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    const resetInSeconds = Math.max(1, Math.ceil((record.resetTime - now) / 1000));
    return { limited: true, remaining: 0, resetInSeconds };
  }
  record.count++;
  const resetInSeconds = Math.max(1, Math.ceil((record.resetTime - now) / 1000));
  return { limited: false, remaining: RATE_LIMIT_MAX_REQUESTS - record.count, resetInSeconds };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
    return;
  }

  if (req.method === "POST" && req.url === "/chat") {
    const clientIp = getClientIp(req);
    const rateLimit = checkRateLimit(clientIp);
    res.setHeader("X-RateLimit-Limit", String(RATE_LIMIT_MAX_REQUESTS));
    res.setHeader("X-RateLimit-Remaining", String(rateLimit.remaining));
    res.setHeader("X-RateLimit-Reset", String(rateLimit.resetInSeconds));

    if (rateLimit.limited) {
      res.writeHead(429, {
        "Content-Type": "application/json",
        "Retry-After": String(rateLimit.resetInSeconds),
      });
      res.end(
        JSON.stringify({
          error: "Rate limit exceeded. Please wait a moment before sending more requests.",
        })
      );
      return;
    }

    try {
      const body = JSON.parse(await readBody(req));
      const { messages, documentContext, projectInstructions } = body;
      if (!Array.isArray(messages) || messages.length === 0) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "messages (non-empty array) is required" }));
        return;
      }
      const groqStream = await streamChat({ messages, documentContext, projectInstructions });
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      groqStream.pipe(res);
      groqStream.on("error", (err) => {
        console.error("Groq stream error:", err);
        res.end();
      });
    } catch (err) {
      console.error("Chat request failed:", err);
      // Headers may already be flushed if the failure happened mid-stream —
      // guard so we don't crash the process trying to send a second response.
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Chat request failed", detail: String(err) }));
      } else {
        res.end();
      }
    }
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => console.log(`ai-service listening on http://localhost:${PORT}`));
