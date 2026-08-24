# IEEE Paper Builder

Formatting an IEEE conference paper by hand in Word or LaTeX is tedious and error-prone, especially without LaTeX experience — the same margin/font/column rules get re-applied from scratch every time, and it's easy to get something subtly wrong. This project replaces that with a FlowCV-style drag-and-drop editor: you build the paper from content blocks (title, abstract, sections, figures, tables, equations, references), and a live, paginated two-column preview stays byte-accurate to IEEE's conference format automatically as you edit — no manual formatting, no LaTeX to learn.

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
- Run the entire contents of [`supabase/schema.sql`](supabase/schema.sql) in the SQL Editor once.
- Grab your **Project URL** and **anon/publishable key** from Project Settings → API.

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
Get a free API key at [console.groq.com](https://console.groq.com) (API Keys → Create API Key). Create `ai-service/.env`:
```
GROQ_API_KEY=<your key>
```
```
cd ai-service
npm start
```
Runs at `http://localhost:3002`. Chat and image generation both work with this alone — image generation (Pollinations.ai) needs no API key at all.

If any of the frontend's default service URLs don't match your setup, override them via `app/.env`: `VITE_PDF_SERVICE_URL` and `VITE_AI_SERVICE_URL`.
