// Vercel Function: receives Content-Security-Policy violation reports and
// writes one line per violation to the function logs.
import { handleCspReport } from "../src/lib/security/cspReport.js";

export function POST(request: Request): Promise<Response> {
  return handleCspReport(request);
}
