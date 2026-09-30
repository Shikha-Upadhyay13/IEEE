// Vercel Function: server-rendered link previews for shared papers.
// vercel.json rewrites /view/:id here only for link-preview bots.
import { handleShareRequest } from "../src/lib/seo/shareHandler.js";

export function GET(request: Request): Promise<Response> {
  return handleShareRequest(request, {
    supabaseUrl: process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY,
    siteUrl: process.env.VITE_SITE_URL,
  });
}
