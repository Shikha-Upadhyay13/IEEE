import http from "node:http";
import { streamChat } from "./groqClient.mjs";

const PORT = process.env.PORT ?? 3002;
// Dev-only permissive CORS, same rationale as pdf-service/server.mjs — fine
// for a solo-student local setup; tighten to an explicit allowlist before
// any real deployment.
const ORIGIN = process.env.FRONTEND_ORIGIN ?? "http://localhost:3000";

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
    try {
      const body = JSON.parse(await readBody(req));
      const { messages, documentContext } = body;
      if (!Array.isArray(messages) || messages.length === 0) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "messages (non-empty array) is required" }));
        return;
      }
      const groqStream = await streamChat({ messages, documentContext });
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
