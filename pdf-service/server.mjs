import http from "node:http";
import { renderPdf } from "./render.mjs";
import { HttpError, isExportTokenValid, parseExportRequest, readBody } from "./exportRequest.mjs";
import { captureError, initMonitoring } from "./monitoring.mjs";

await initMonitoring("pdf-service");

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

// ─── Render Queue & Concurrency Management ──────────────────────────────────
const MAX_CONCURRENT_RENDERS = parseInt(process.env.MAX_CONCURRENT_RENDERS ?? "2", 10);
const MAX_QUEUE_SIZE = parseInt(process.env.MAX_QUEUE_SIZE ?? "10", 10);
const RENDER_TIMEOUT_MS = parseInt(process.env.RENDER_TIMEOUT_MS ?? "45000", 10);

let activeRenders = 0;
const waitingQueue = [];

function processNextJob() {
  if (activeRenders >= MAX_CONCURRENT_RENDERS || waitingQueue.length === 0) {
    return;
  }
  const job = waitingQueue.shift();
  activeRenders++;

  let timedOut = false;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
    const timeoutErr = new Error("Render timed out");
    timeoutErr.isTimeout = true;
    job.reject(timeoutErr);
  }, RENDER_TIMEOUT_MS);

  job.task(controller.signal)
    .then((result) => {
      if (!timedOut) {
        clearTimeout(timeoutId);
        job.resolve(result);
      }
    })
    .catch((err) => {
      if (!timedOut) {
        clearTimeout(timeoutId);
        job.reject(err);
      }
    })
    .finally(() => {
      activeRenders--;
      processNextJob();
    });
}

function queueRender(task) {
  if (waitingQueue.length >= MAX_QUEUE_SIZE) {
    const queueFullErr = new Error("Render queue is full");
    queueFullErr.isQueueFull = true;
    return Promise.reject(queueFullErr);
  }
  return new Promise((resolve, reject) => {
    waitingQueue.push({ task, resolve, reject });
    processNextJob();
  });
}

function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(JSON.stringify(body));
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

  if (req.method === "GET" && req.url === "/queue") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        activeRenders,
        queuedRenders: waitingQueue.length,
        maxConcurrent: MAX_CONCURRENT_RENDERS,
        maxQueue: MAX_QUEUE_SIZE,
      })
    );
    return;
  }

  if (req.method === "POST" && req.url === "/export") {
    try {
      const { documentId, token } = parseExportRequest(await readBody(req));
      if (!(await isExportTokenValid(token))) {
        throw new HttpError(401, "Export link expired. Please try again.");
      }
      const pdfBuffer = await queueRender((signal) => renderPdf({ documentId, token, signal }));
      res.writeHead(200, {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=paper.pdf",
      });
      res.end(pdfBuffer);
    } catch (err) {
      if (err instanceof HttpError) {
        sendJson(res, err.status, { error: err.message });
        return;
      }
      if (err.isQueueFull) {
        sendJson(res, 503, { error: "Render queue is full. Please try again in a few moments." }, { "Retry-After": "10" });
        return;
      }
      if (err.isTimeout) {
        captureError(err, { route: "/export", reason: "timeout" });
        sendJson(res, 504, { error: "Render timed out. Ensure all external assets and images are accessible." });
        return;
      }
      console.error("Export failed:", err);
      captureError(err, { route: "/export" });
      sendJson(res, 500, { error: "Export failed" });
    }
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => console.log(`pdf-service listening on http://localhost:${PORT}`));
