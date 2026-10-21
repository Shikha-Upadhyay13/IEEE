# IEEE Paper Builder — Production Plan

This plan takes the app from "single-user conference-paper drafter" to a
team product: multiple IEEE formats, controlled styling, compliance checks,
workspaces, async collaboration and notifications, with the build, test and
release practices needed for an app that is already in production.

It replaces the non-goals in `PRD.md` (collaboration, journal formats), which
no longer apply.

## Decisions

| Topic | Decision |
| --- | --- |
| Collaboration | Async: shared papers with roles, comments, suggestions, notifications, conflict-safe saves. No live co-typing. |
| Team model | Workspaces own papers; members have roles; admins manage members and shared templates. |
| Styling | Three modes per paper: **Submission** (locked to the IEEE spec), **Draft** (IEEE layout plus review aids), **Custom** (free styling, clearly marked not IEEE-compliant). |
| Formats | Rollout order below; each format is a data-driven `FormatSpec`. |

### Format rollout

1. **Conference** (Letter and A4, IEEE Word template geometry) and **Peer-review draft** (single column, 1.5 spacing). This covers most student and conference use.
2. **Journal / Transactions** (running heads, first-page footnote, biographies) and **Technote**.
3. **IEEE Access**, **Computer Society** (conference and journal) and **Letters** (SPL, WCL page limits) — done.

Geometry per format (from IEEEtran v1.8b and the IEEE Word templates):

| Format | Page | Columns | Margins (T/B/L/R) | Body |
| --- | --- | --- | --- | --- |
| Conference, Letter | 8.5×11in | 2 × 3.5in, 0.25in gap | 0.75 / 1 / 0.625 / 0.625in | Times 10/12pt |
| Conference, A4 | 210×297mm | 2 × 88mm, 4mm gap | 19 / 43 / 15 / 15mm | Times 10/12pt |
| Peer-review draft | Letter or A4 | 1 × 6.5in | 1in all round | Times 12pt, 1.5 spacing |
| Journal | Letter | 2 × 3.5in, 0.25in gap | 0.75 / 1 / 0.625 / 0.625in | Times 10/12pt, running heads 7pt |
| CompSoc conference | Letter | 2 × 3.375in, 0.25in gap | 1 / 1 / 0.75 / 0.75in | Times 10/11.2pt, Arabic headings |

Always-on IEEE conventions: headings `I. INTRODUCTION` (centered small caps),
`A. Subsection` (italic), `1) Run-in:` and `a) Run-in:`; captions `Fig. 1.`
below figures and `TABLE I` above tables (8pt); bold run-in `Abstract—` and
`Index Terms—`; no page numbers or headers on conference submissions.

## Phase 0 — Security fixes (done)

- Lists only show your own papers; zero-row writes are reported as failures.
- Shared papers are fetched one at a time through `get_shared_document`
  (migration 005); no anonymous enumeration; figure listing is owner-only;
  bucket MIME and size limits.
- PDF service: UUID validation, 4 KB body cap, token checked before
  Chromium starts, browser closed on timeout, no error detail leaks.
- AI service: body and field caps, client system messages dropped.
- Security headers on Vercel.

## Phase 1 — Rendering correctness and format foundation

Goal: what the preview shows is exactly what the PDF contains, driven by data.

1. `lib/formats/` registry: `FormatSpec` (page size, margins, columns, fonts,
   heading scheme, caption style, abstract rules, page limit defaults, front
   matter, and which properties are locked, bounded or free).
2. Generate the `@page` and layout CSS from the spec and hand it to Paged.js
   as a stylesheet. Inline `<style>` blocks are not read by Paged.js, which
   is why A4 and page numbers did not paginate correctly.
3. Fix `Fig. -1` in caption cross-references and use tree depth (not the
   stored `level`) for heading styles.
4. Validate documents with Zod on load and repair older shapes instead of
   crashing.
5. Small fixes: e2e button label, `.env.example` files ignored by git.

## Phase 2 — Formats and style modes

1. `meta.format` (conference, peer-review, then journal) and `meta.mode`
   (submission, draft, custom), defaulting existing papers to
   conference + submission so nothing changes for them.
2. Format picker with a preview, page-count estimate and an automatic
   version snapshot before switching.
3. Mode rules in one place (`lib/formats/modes.ts`): Submission locks font,
   spacing, link styling and page numbers; Draft allows page numbers, line
   spacing and a "DRAFT" watermark; Custom unlocks everything and marks the
   paper "Not IEEE-compliant" in the editor, the export dialog and the PDF
   metadata.
4. Appearance panel shows a lock with a short "Why?" note for each property
   the current mode fixes.
5. Conference copyright-notice footer option (e.g.
   `979-8-XXXX-XXXX-X/YY/$31.00 ©20YY IEEE`, US Gov, Crown and EU variants).
6. Then journal and technote formats: running heads, first-page footnote,
   author biographies.

## Phase 3 — Compliance and submission readiness

1. Checks get a severity (blocker, warning, info), a "jump to" and, where
   safe, a one-click fix. A readiness summary sits in the editor top bar.
2. Format-aware rules: abstract length (journals 150–250 words), keywords
   present, page limit, every figure and table cited in text, captions
   present, unused or duplicate references, IEEE reference style (et al.
   beyond six authors, abbreviated months, lowercase `doi:`, en-dash page
   ranges), acronyms defined on first use.
3. Figure resolution check (300 dpi photos, 600 dpi line art at 3.5in or
   7.16in width).
4. Reference checks: Crossref metadata match, duplicates, retractions via
   Crossref `update-to`.
5. Double-blind mode: hide authors, affiliations and acknowledgements.
6. AI-use disclosure helper for the acknowledgements section.
7. Downloadable readiness report; Submission-mode export is blocked while
   blockers remain.
8. PDF eXpress-friendly export: strip link annotations and bookmarks, set
   title and author metadata, PDF 1.4–1.7, no encryption.

## Phase 4 — Workspaces and async collaboration

Data model (migration 006+), all guarded by row-level security through
`security definer` helpers `can_read_document(id)` / `can_edit_document(id)`:

- `workspaces`, `workspace_members` (owner, admin, member),
  `workspace_invitations` (email, role, token, expiry).
- `documents.workspace_id`, `document_members` (owner, editor, reviewer,
  viewer), `documents.version` for conflict-safe saves.
- `comments` (thread anchored to a block id, resolved flag, mentions).
- `suggestions` (block-level proposed text from reviewers; accept or reject).

Product:

1. Workspace switcher; create a personal workspace for every existing user
   and move their papers into it (no data loss, nothing shared by default).
2. Share dialog: invite by email with a role; link sharing stays separate.
3. Version-checked saves: a save that lost a race shows "This paper changed
   since you opened it" with reload or keep-mine options, never a silent
   overwrite. A soft edit lock shows who else is editing.
4. Comments panel with threads, replies, resolve, and @mentions.
5. Reviewer role: edits become suggestions that the owner or editors
   accept or reject.
6. Dashboard tabs: My papers, Shared with me, Workspace, Archived, Trash
   (30-day restore), plus tags and search.
7. Workspace templates: admins publish a paper as a template for members.

## Phase 5 — Notifications

1. `notifications` table plus an in-app inbox (bell with unread count,
   Supabase Realtime updates, mark read, mark all read).
2. Events: invited to a workspace or paper, mentioned, reply in your thread,
   comment or suggestion on your paper, suggestion accepted or rejected,
   export finished or failed, venue deadline reminders.
3. `notification_preferences`: event × channel (in-app, email) matrix, plus
   a per-paper level (all, mentions and replies, none).
4. Email through a Supabase Edge Function: only for items still unread
   after 10 minutes, batched per recipient, with a one-click unsubscribe
   link (RFC 8058). Security and account email can't be unsubscribed.

## Phase 6 — Settings and account

Settings becomes a tabbed page:

- **Profile**: name, ORCID, affiliation, default author block for new papers.
- **Account & security**: email and password changes, sign out other
  sessions, two-factor authentication (TOTP).
- **Preferences**: default format, paper size and mode; spelling dialect
  (US or UK); theme; editor preferences.
- **Notifications**: the matrix from Phase 5.
- **Workspace**: members, roles, invitations, shared templates.
- **Data & privacy**: export and account deletion (existing).

## Phase 7 — Build, test and delivery

1. Supabase CLI migrations with a migrations folder that CI applies to a
   local stack; row-level security tests for every table and role.
2. PDF fidelity tests: render sample papers per format and compare page
   count, page size and column positions; screenshot comparison of the
   first page.
3. Component tests for the editor panels; e2e for share, invite, comment
   and export flows using a seeded test account.
4. Staging environment (separate Supabase project), Vercel preview
   deploys, and a release checklist with migration-first ordering.
5. Content-Security-Policy in report-only mode, then enforced.
6. Bundle-size budget in CI; error and performance alerts in Sentry;
   product funnels in PostHog.
7. Runbook: rollback, restoring a paper from versions, rotating keys,
   Supabase pausing.

## Working rules

- Every change is its own commit, pushed to `main`, with typecheck,
  unit tests and lint passing first.
- Database changes ship as numbered migrations and must be applied before
  the app version that needs them is deployed.
- Existing papers must keep rendering identically unless the user changes
  their format or mode.
