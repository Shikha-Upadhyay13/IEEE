import http from "node:http";
import { renderPdf } from "./render.mjs";

const PORT = process.env.PORT ?? 3001;
// Explicit CORS origin allowlist from env (supports comma-separated list),
// falling back to local frontend dev servers.
const rawAllowed = process.env.ALLOWED_ORIGINS ?? process.env.FRONTEND_ORIGIN ?? "http://localhost:3000,http://localhost:5173";
const ALLOWED_ORIGINS = new Set(
  rawAllowed
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "CORS origin not allowed" }));
      return;
    }
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
    return;
  }

  if (req.method === "POST" && req.url === "/export") {
    try {
      const body = JSON.parse(await readBody(req));
      const { documentId, token } = body;
      if (!documentId) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "documentId is required" }));
        return;
      }
      const pdfBuffer = await renderPdf({ documentId, token });
      res.writeHead(200, {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=paper.pdf",
      });
      res.end(pdfBuffer);
    } catch (err) {
      console.error("Export failed:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Export failed", detail: String(err) }));
    }
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => console.log(`pdf-service listening on http://localhost:${PORT}`));
