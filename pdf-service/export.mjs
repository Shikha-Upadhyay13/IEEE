import path from "node:path";
import fs from "node:fs/promises";
import { renderPdf } from "./render.mjs";

// CLI usage for local testing: node export.mjs <documentId> [token] [outputPath]
// (token is optional — omit it to test the "authenticated session" path by
// visiting /print/:documentId directly while logged in in that browser, or
// pass one minted via the create_export_token RPC to test the headless path.)
const [documentId, token, outputArg] = process.argv.slice(2);
if (!documentId) {
  console.error("Usage: node export.mjs <documentId> [token] [outputPath]");
  process.exit(1);
}
const outputPath = path.resolve(outputArg ?? "output.pdf");

const pdfBuffer = await renderPdf({ documentId, token: token || undefined });
await fs.writeFile(outputPath, pdfBuffer);
console.log(`Exported PDF to ${outputPath}`);
