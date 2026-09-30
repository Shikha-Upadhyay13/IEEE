# IEEE Paper Builder

## The problem

Students, researchers, and professors publishing an IEEE conference paper have to manually apply IEEE's exacting format rules — fonts, margins, two-column layout, figure/table placement, citation numbering — by hand in Word or LaTeX, for every single paper. In practice this is:

- **Tedious and repetitive** — the exact same formatting rules get re-applied from scratch each time.
- **Error-prone** — it's very easy to get spacing, font sizes, or caption placement subtly wrong, risking rejection or professor pushback.
- **A barrier for non-technical users** — LaTeX requires learning a whole markup language; Word's IEEE template is fragile and breaks on paste.

## How we solve it

A FlowCV-style drag-and-drop editor: you build the paper from content blocks (title, abstract, sections, figures, tables, equations, references), and a live, paginated two-column preview stays byte-accurate to IEEE's conference format automatically as you edit — no manual formatting, no LaTeX to learn. What you see in the preview is exactly what gets exported to PDF, from the same rendering pipeline, not a separate conversion step.

## What it does

**Paper editor**
- Drag-and-drop block editor — sections, paragraphs, figures, tables, equations, references — with collapsible sections and a "Move to…" control for reorganizing content across sections
- Rich text (bold/italic/superscript), inline citations, and cross-references to figures/tables that auto-number by first-appearance order — nothing is ever hand-numbered or left stale after reordering
- Live, paginated, two-column preview (via Paged.js) that matches the real IEEE conference template — Times New Roman at the prescribed point sizes, correct margins and column widths
- Both official IEEE conference paper sizes: US Letter and A4 (own margin spec each, sourced from IEEE's own template documentation)
- Optional page numbers — off by default, since IEEE's own template guidance says not to include them (most venues add them during publication)
- A font picker for drafting in something other than Times New Roman, clearly flagged as non-submission-compliant when used
- Click-to-fullscreen preview, and one-click PDF export via a headless-Chromium pipeline identical to what you see on screen

**Dashboard**
- Every paper shown as a live-rendered thumbnail of its actual content, not a placeholder
- Search, duplicate, rename, delete (with a proper confirmation dialog, not the browser's native popup)

**Downloads**
- Every PDF you export is also kept in one place (private cloud storage), re-downloadable anytime — not just wherever your OS Downloads folder put it

**AI Assistant**
- A ChatGPT-style chat (Groq's free tier) for help drafting or refining your paper's *content* — it never touches formatting, which stays automatic and guaranteed elsewhere in the app
- Saved conversation history, organized into projects, with a sidebar like a modern chat product
- Attach one of your papers to a conversation for context, and insert an AI reply straight back into that paper

**Images**
- Free, keyless image generation (Pollinations.ai) with a persisted gallery — useful for mocking up figures or diagrams

**Account**
- Supabase auth (email/password), a profile page, and Light/Dark/System theme (currently scoped to the AI Assistant/Images/account pages)

## Tech stack

- **Frontend**: React + TypeScript + Vite, Tailwind CSS v4, Zustand (state), dnd-kit (drag-and-drop), TipTap (rich text), MathLive/KaTeX (equations), Paged.js (pagination)
- **Backend**: [Supabase](https://supabase.com) — Postgres + Row Level Security, Auth, Storage
- **`pdf-service/`**: a small Node + Playwright microservice that renders the same DOM the live preview uses and exports it to PDF — one rendering pipeline, not two
- **`ai-service/`**: a small Node microservice proxying chat requests to Groq — keeps the API key server-side, since a `VITE_`-prefixed env var would ship straight into the browser bundle

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the full system design and rationale behind these choices, and [`PRD.md`](PRD.md) for the original product spec (note: the product has grown past that document's original non-goals in places, most notably the AI Assistant and Images — see the app itself for current scope).

## Project structure

```
app/            React + Vite frontend — the editor, dashboard, AI Assistant, etc.
pdf-service/    Headless-Chromium PDF export microservice
ai-service/     Groq (chat) + image-generation proxy microservice
supabase/       schema.sql — the Postgres schema, RLS policies, and storage bucket setup
references/     Reference material used while building the IEEE template
```

## Running it locally

You'll need three processes running at once (frontend, PDF export service, AI service), plus a Supabase project.

**1. Supabase**
- Create a free project at [supabase.com](https://supabase.com).
- Run the entire contents of [`supabase/schema.sql`](supabase/schema.sql) in the SQL Editor once, then each file in [`supabase/migrations/`](supabase/migrations) in order (`004_account_deletion.sql` powers self-service account deletion in Settings).
- Grab your **Project URL** and **anon/publishable key** from Project Settings → API.

> **Free-tier projects pause after about a week without activity.** When that happens the project's hostname stops resolving and every sign-in, save, and load fails with a network error (the app shows a "we can't reach our servers" message instead of a blank screen). Restore it from the Supabase dashboard (Project → Restore), then reload the app. For a live deployment, either upgrade to a paid plan or keep the project active with a scheduled ping (for example a daily cron hitting `<project URL>/auth/v1/health` with the anon key).

**2. Frontend (`app/`)**
```
cd app
npm install
```
Create `app/.env`:
```
VITE_SUPABASE_URL=<your project URL>
VITE_SUPABASE_ANON_KEY=<your anon/publishable key>
```
```
npm run dev
```
Runs at `http://localhost:3000` (or whatever port you pass via `--port`).

**3. PDF export service (`pdf-service/`)**
```
cd pdf-service
npm install
npx playwright install chromium
FRONTEND_URL=http://localhost:3000 FRONTEND_ORIGIN=http://localhost:3000 npm start
```
Runs at `http://localhost:3001`.

**4. AI service (`ai-service/`)**
Get a free API key at [console.groq.com](https://console.groq.com) (API Keys → Create API Key). Create `ai-service/.env` (see `ai-service/.env.example`):
```
GROQ_API_KEY=<your key>
SUPABASE_URL=<your project URL>
SUPABASE_ANON_KEY=<your anon/publishable key>
```
`/chat` only answers signed-in users: the frontend sends the Supabase access token and the service checks it with Supabase Auth before calling Groq, so the endpoint can't be used as a free Groq proxy. Rate limits are applied per user. For quick local experiments without signing in you can set `AI_AUTH_DISABLED=true` — never in production.
```
cd ai-service
npm start
```
Runs at `http://localhost:3002`. Chat and image generation both work with this alone — image generation (Pollinations.ai) needs no API key at all.

If any of the frontend's default service URLs don't match your setup, override them via `app/.env`: `VITE_PDF_SERVICE_URL` and `VITE_AI_SERVICE_URL`.

**End-to-end tests.** From `app/`, `npm run e2e` runs the Playwright suite against the Vite dev server (`npx playwright install chromium` once, or set `E2E_BROWSER_CHANNEL=msedge` / `chrome` to use an installed browser). The signed-in flow (create, reorder, cite, cross-ref, export) runs only when `E2E_EMAIL` and `E2E_PASSWORD` point at a test account; add `E2E_PDF_SERVICE=1` with pdf-service running to include the export step. In CI, set the `E2E_EMAIL`, `E2E_PASSWORD`, `E2E_SUPABASE_URL` and `E2E_SUPABASE_ANON_KEY` repository secrets to enable it.

**Monitoring (optional).** Nothing is sent anywhere unless these are set:
- `app/.env`: `VITE_SENTRY_DSN` for frontend crash reports; `VITE_POSTHOG_KEY` (and optionally `VITE_POSTHOG_HOST`) for product analytics.
- `ai-service/.env` and the `pdf-service` environment: `SENTRY_DSN` (optionally `SENTRY_ENVIRONMENT`).

Analytics only records these events, never paper content (autocapture and session recording are off): `signed_up`, `paper_created`, `citation_inserted`, `pdf_exported`, `pdf_export_failed`. Build a PostHog funnel from `signed_up` → `paper_created` → `citation_inserted` → `pdf_exported` to track time from signup to first export.
