# Architecture: IEEE Paper Builder

**Status:** Draft v1 · companion to `PRD.md` and the milestone plan.

This document describes the system architecture in enough concrete detail to start implementing against it. Decisions here are final for MVP unless a milestone proves an assumption wrong (see §8, Milestone 1 pivot criteria).

---

## 1. System Overview

```
                        ┌─────────────────────────────┐
                        │   Browser (Chromium-based)   │
                        │                               │
                        │  React SPA (Vite)             │
                        │  ┌─────────────┐  ┌─────────┐ │
                        │  │ Block Editor │→│ Document │ │
                        │  │ (dnd-kit +   │  │  State   │ │
                        │  │  TipTap)     │  │ (Zustand)│ │
                        │  └─────────────┘  └────┬────┘ │
                        │                        │       │
                        │              ┌─────────▼─────┐ │
                        │              │ numbering.ts   │ │
                        │              │ (resolve pass) │ │
                        │              └─────────┬─────┘ │
                        │                        │       │
                        │              ┌─────────▼─────┐ │
                        │              │ IEEEConference │ │
                        │              │ Template.tsx   │ │
                        │              │ + Paged.js     │ │
                        │              └────────────────┘ │
                        └───────┬───────────────┬─────────┘
                                │               │
                    save/load   │               │  export request
                                ▼               ▼
                  ┌─────────────────────┐   ┌───────────────────────┐
                  │      Supabase        │   │  PDF Export Service    │
                  │  - Postgres (docs)   │   │  (Node + Playwright)   │
                  │  - Auth              │   │  navigates to hidden   │
                  │  - Storage (images)  │   │  /print/:id route,     │
                  │  - Row Level Security│   │  calls page.pdf()      │
                  └─────────────────────┘   └───────────┬───────────┘
                                                          │
                                                          ▼
                                              same deployed React app
                                              (renders /print/:id using
                                               the identical component
                                               tree as the live editor)
```

**Key property this diagram is meant to convey:** there is exactly one rendering pipeline (`numbering.ts` → `IEEEConferenceTemplate.tsx` → Paged.js). The live editor and the PDF export service both go through it — the export service just navigates a headless browser to the same deployed frontend's `/print/:id` route instead of rendering a second time in a different engine. This is the single most important architectural invariant in the whole system; do not let PDF export grow its own rendering logic.

---

## 2. Frontend Architecture

### 2.1 Module boundaries

- **`dnd-kit` owns block order.** Anything about "is this block above or below that block" goes through dnd-kit's `sortable` context.
- **TipTap owns in-block rich text.** Bold/italic and the custom inline `citeRef`/`xref` nodes live inside a TipTap editor instance scoped to a single paragraph/abstract block.
- **These two never overlap.** TipTap instances do not manage drag handles or block-level reordering; dnd-kit does not reach inside a block's text content.
- **`numbering.ts` is a pure function.** `(document: Document) => ResolvedDocument`. No side effects, no React dependency — testable in isolation, callable identically from the client editor and (if ever needed) a server-side context.
- **`IEEEConferenceTemplate.tsx` is a pure render tree.** Takes a `ResolvedDocument` and CSS classes from `ieee-template.css`; has no knowledge of editing, dnd-kit, or Supabase. This is what makes it reusable unchanged between the live preview and the `/print/:id` export route.

### 2.2 State management

- **Zustand store** holds the current `Document` (the editable, unresolved JSON — see §3).
- Every mutation (add/remove/reorder block, edit text, upload image) updates the Zustand store.
- A debounced (150–300ms) subscriber calls `numbering.ts` to produce the `ResolvedDocument`, which is what `IEEEConferenceTemplate.tsx` actually renders. Editing keystrokes do not re-run numbering on every character — only after the debounce settles.
- Autosave: a separate, longer-debounced (~2s) subscriber persists the `Document` to Supabase.

### 2.3 Folder structure

```
src/
  types/
    document.ts          # Zod schema + inferred TS types (Document, Block union, etc.)
  lib/
    numbering.ts          # pure resolve pass: Document -> ResolvedDocument
    numbering.test.ts
    pagination/
      pagedjs-adapter.ts  # Paged.js bootstrap + custom break-handling plugins
  store/
    documentStore.ts      # Zustand store + debounced numbering/autosave subscribers
  components/
    editor/
      BlockList.tsx        # dnd-kit sortable context over top-level body blocks
      SectionBlock.tsx
      FigureBlock.tsx
      TableBlock.tsx
      EquationBlock.tsx    # wraps MathLive input
      ReferenceListEditor.tsx
      RichText.tsx         # TipTap wrapper + custom citeRef/xref node
    renderer/
      IEEEConferenceTemplate.tsx   # pure render tree, shared by editor preview + print route
    dashboard/
      DocumentList.tsx
  routes/
    editor/[documentId].tsx   # editor + live preview (BlockList + IEEEConferenceTemplate side by side)
    print/[documentId].tsx    # chrome-less, print-only route: fetch doc -> resolve -> IEEEConferenceTemplate
    dashboard.tsx
    login.tsx
  styles/
    ieee-template.css     # the fixed, never-user-editable @page/column/font spec
  supabaseClient.ts

pdf-service/                # separate deployable, NOT part of the Vite app bundle
  server.ts                 # Express (or plain http) with one POST /export/:documentId endpoint
  playwright-render.ts       # navigates headless Chromium to {FRONTEND_URL}/print/:id, calls page.pdf()
  package.json               # own dependencies (playwright), own deploy (Render/Railway)
```

### 2.4 Print route contract

`routes/print/[documentId].tsx`:
1. Reads `documentId` from the URL.
2. Fetches the document JSON directly from Supabase (public read via a short-lived signed token passed in the URL, or a service-role fetch if the PDF service calls an internal API — see §5.3 for the exact auth approach).
3. Runs it through the same `numbering.ts` + `IEEEConferenceTemplate.tsx` used by the editor.
4. Renders **only** the template — no editor chrome, no navigation, no dev tools overlay.
5. Signals render-complete (e.g., sets `document.title` or a `data-render-ready` attribute on `<body>`) so Playwright knows when to call `page.pdf()` rather than racing the paint.

---

## 3. Document Data Model

```ts
// src/types/document.ts (shape; see Zod schema for the authoritative version)
type Document = {
  schemaVersion: 1;
  meta: { template: "ieee-conference"; paperSize: "letter" | "a4"; pageLimit: number | null };
  titleBlock: {
    title: RichTextRun[];
    authors: { id: string; name: string; affiliationRefs: string[]; email?: string }[];
    affiliations: { id: string; text: string }[];
  };
  abstract: { text: string };
  keywords: string[];
  body: BodyNode[];              // ordered — array position IS the drag-and-drop order
  references: Reference[];
};

type BodyNode =
  | { type: "section"; id: string; heading: string; level: number; children: BodyNode[] }
  | { type: "paragraph"; id: string; content: (TextRun | CiteRef | XRef)[] }
  | { type: "figure"; id: string; width: "single-column" | "double-column"; image: ImageRef; caption: RichTextRun[] }
  | { type: "table"; id: string; width: "single-column" | "double-column"; caption: RichTextRun[]; rows: string[][] }
  | { type: "equation"; id: string; latex: string };

type Reference = { id: string; fields: Record<string, string>; renderedText: string };
```

**Invariant**: figure/table/section/citation *numbers* are never stored in this model — only stable `id`s. `numbering.ts` computes a parallel `ResolvedDocument` (same shape, with numbers attached) at render time. Reordering, adding, or deleting a block never requires a "renumber" migration step because nothing is ever persisted with a baked-in number.

---

## 4. Pagination & Numbering Pipeline (data flow for a single edit)

```
User types in a paragraph / drags a block
        │
        ▼
Zustand store updated (raw Document)
        │
        ├──(debounce 150-300ms)──▶ numbering.ts tree-walk
        │                              │
        │                              ▼
        │                    ResolvedDocument (numbers attached:
        │                    figures=Arabic, tables=Roman,
        │                    citations=first-appearance order)
        │                              │
        │                              ▼
        │                    IEEEConferenceTemplate.tsx re-renders
        │                              │
        │                              ▼
        │                    Paged.js re-chunks DOM into
        │                    .pagedjs_page containers, re-flows
        │                    two-column content, re-applies
        │                    break-after/orphan fix-up pass
        │
        └──(debounce ~2s)───▶ Supabase autosave (raw Document only)
```

`numbering.ts` responsibilities, concretely:
- Walk `body` depth-first, assigning Arabic numbers to `figure` nodes and Roman numerals (simple int→Roman, no library) to `table` nodes, in document order.
- Walk `body` for `citeRef` nodes, building a `Map<refId, number>` keyed by first-occurrence order; reused for every subsequent citation of the same `refId`.
- Sort `references` for display by that citation-order map (not by their array position in `Document.references`).
- Assign section numbers (Roman numerals for top-level, per IEEE convention) by position among sibling `section` nodes.
- Output is a new object tree, same shape as `Document.body` but with a `resolvedNumber` field added to each numbered node type — `IEEEConferenceTemplate.tsx` reads `resolvedNumber`, never recomputes it.

---

## 5. PDF Export Pipeline

### 5.1 Trigger
User clicks "Export PDF" in the editor → frontend calls `POST {PDF_SERVICE_URL}/export/:documentId` with an auth token.

### 5.2 Service responsibilities (`pdf-service/`)
1. Validate the caller's auth token (see §5.3) and that they own `documentId`.
2. Launch (or reuse a warm pooled instance of) headless Chromium via Playwright.
3. Navigate to `{FRONTEND_URL}/print/:documentId?token=<short-lived-export-token>`.
4. `page.emulateMedia({ media: 'print' })`.
5. Wait for the render-complete signal (§2.4 step 5) — not a fixed timeout.
6. `page.pdf({ printBackground: true, margin: { top:0, bottom:0, left:0, right:0 } })` — zero Chromium-applied margin, since `ieee-template.css`'s `@page` rule already encodes the true IEEE margins; a second margin here would double up.
7. Stream the PDF bytes back as the HTTP response.

### 5.3 Auth between services
The PDF service needs to fetch a specific user's document via the print route without exposing that document publicly. Approach: the frontend, when initiating export, requests a short-lived (e.g. 60s) signed token scoped to `documentId` from Supabase (a Postgres function or edge function using the service role key), passes that token to the PDF service, which passes it through as a query param to `/print/:documentId?token=...`; the print route verifies the token (not the user's session cookie, since Playwright's browser context has no user session) before fetching the document. This avoids making documents publicly readable while keeping the print route simple and stateless.

### 5.4 Hosting
`pdf-service` is a **separate deployable** from the Vite frontend — a small Node process (e.g. on Render.com) that only Playwright can run on (needs a real Linux process with a Chromium binary; will not run on typical static/edge hosting). Treat it as a two-endpoint microservice (`POST /export/:id`, `GET /health`), not a general backend — resist the urge to grow other functionality into it.

---

## 6. Backend (Supabase)

### 6.1 Tables (Postgres)
```sql
documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) not null,
  title text,                    -- denormalized from titleBlock.title for dashboard listing
  content jsonb not null,        -- the full Document JSON (§3)
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Row Level Security: owner_id = auth.uid() for select/insert/update/delete
```

### 6.2 Storage
- Bucket `figures/{owner_id}/{documentId}/{imageId}.{ext}` for uploaded figure images, RLS-scoped by owner.

### 6.3 Auth
- Supabase Auth (email/password to start; social providers can be added later without architecture changes).

---

## 7. Deployment Topology

- **Frontend** (`src/`): static build, deployed to Vercel or Netlify (free tier). Serves both the editor UI and the `/print/:id` route.
- **PDF service** (`pdf-service/`): deployed separately to Render.com (or Railway), needs to know `FRONTEND_URL` to navigate to.
- **Supabase**: hosted project, free tier (500MB DB / 1GB storage / 50k MAU — sufficient for a real student pilot).
- No custom server for anything other than PDF export.

---

## 8. Architectural Decisions & Rationale (recap)

| Decision | Rejected alternatives | Why |
|---|---|---|
| Paged.js for pagination | Pure CSS multicol; WASM LaTeX (SwiftLaTeX) | CSS multicol has no multi-*page* flow primitive; WASM LaTeX kills live-editing latency and loses DOM interactivity once compiled |
| Headless Chromium print-to-PDF of the same DOM | html2canvas+jsPDF; native browser print dialog; a separate PDF-generation library | Any second rendering path is a second place for the format to drift from what the user saw |
| dnd-kit (not react-beautiful-dnd) | react-beautiful-dnd | Archived/unmaintained by Atlassian |
| TipTap (not Editor.js/Lexical/Slate) | Editor.js, Lexical, Slate | Editor.js's block model would fight dnd-kit for ownership of block structure; Lexical/Slate have a steeper curve for this team |
| Supabase (not custom Express server, not Firebase) | Custom Node/Postgres server; Firebase | The backend surface here is 100% BaaS-shaped (auth+CRUD+storage); Postgres/RLS is a more transferable skill than Firestore |
| Numbers derived at render time, never persisted | Storing computed figure/table/citation numbers in the document | Reordering/adding/deleting blocks would otherwise leave stale numbers |

**Milestone 1 pivot criterion** (from the plan file, restated here since it's an architectural risk, not just a scheduling one): if Paged.js/CSS two-column fidelity proves unacceptable against the confirmed IEEE spec after building the hardest-case sample document, the fallback is a LaTeX-based renderer (`IEEEtran.cls` + `tectonic`/`latex-on-http`), decided at that checkpoint — not assumed away.

---

## 9. Security Considerations

- RLS on `documents` and the `figures` storage bucket ensures users only ever read/write their own documents/images.
- The `/print/:id` route is not session-authenticated (Playwright has no user cookies) — it's protected by the short-lived signed export token (§5.3), not by being globally public.
- Uploaded images should be validated (mime type, size cap) client-side before upload and the storage bucket should reject unexpected types server-side (Supabase Storage policies).

## 10. Open Architecture Questions

- Exact mechanism for the short-lived export token (Supabase Edge Function vs. a Postgres function callable via RPC) — decide during Milestone 6 (auth) implementation, not before it's needed.
- Whether `pdf-service` needs a render queue/concurrency cap once real usage starts (not a concern at MVP scale — defer).
