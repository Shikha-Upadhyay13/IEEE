# PRD: IEEE Paper Builder ("FlowCV for IEEE Papers")

**Status:** Draft v1 · **Owner:** Shikha · **Working title:** ieee-paper-builder

---

## 1. Problem Statement

Students (and researchers, developers, PhD candidates, professors) who need to publish their project/research work as an IEEE-formatted paper currently have to manually apply IEEE's exacting format rules — fonts, margins, two-column layout, figure/table placement, citation numbering — by hand in Word or LaTeX, for every single paper. This is:

- **Tedious and repetitive**: the same formatting rules are re-applied from scratch each time.
- **Error-prone**: it's easy to get spacing, font sizes, or caption placement subtly wrong, risking rejection or professor pushback.
- **A barrier for non-technical users**: LaTeX requires learning a markup language; Word's IEEE template is fragile (styles break on paste, columns misbehave).
- **A widespread, validated pain point**: every student in a BTech program who completes a mini/major project faces this; multiple independent sources (Scribbr, ShyEditor, AllConferenceAlert) confirm formatting is broadly experienced as the time-consuming part of paper submission, separate from writing the content itself.

## 2. Vision

A web platform, modeled on the FlowCV resume-builder UX, where a user builds an IEEE paper by dragging and organizing content blocks (title/authors, abstract, sections, figures, tables, references) into place — and the platform guarantees byte-accurate IEEE conference formatting automatically, live, with zero manual font/margin/spacing work.

## 3. Goals

- Eliminate 100% of manual formatting work for a standard IEEE conference paper.
- Give users a live, always-current, paginated two-column preview as they edit — not a "type then click a button and hope" batch step.
- Produce a PDF export that is pixel-identical to what the user saw in the live preview.
- Be usable by a non-technical student with zero LaTeX or Word-styles knowledge.
- Be free or near-free for students (undercutting SciSpace's $8–70/mo tiers).

## 4. Non-Goals (explicitly out of scope for this phase)

- **AI-assisted content generation** (writing the paper's actual text/argument). This tool formats content the user supplies; it does not write it.
- **AI-detection-score testing/optimization.** Not building any integration with AI-content detectors. This is a deliberate, explicit deferral, not an oversight — may be revisited as a separate future phase.
- **IEEE journal/Transactions template support.** MVP targets the conference template only (the common student-project case); journal format has real differences (page numbers, abstract length, margins) that double the formatting-rule surface area.
- **Multi-template marketplace / non-IEEE formats** (APA, MLA, other publishers). One fixed template for MVP.
- **Real-time multi-user collaboration.** Single-owner documents only.
- **Reference-manager features** (DOI lookup, BibTeX import, citation-style switching). Manual structured reference fields only.

## 5. Target Users

- **Primary**: BTech/undergrad students converting a mini/major college project into an IEEE conference paper for the first (or Nth) time.
- **Secondary**: graduate students, PhD candidates, developers, and professors who occasionally need to produce an IEEE-formatted conference paper without deep LaTeX/Word investment.

## 6. Competitive Landscape & Differentiation

| Tool | What it does | Gap it leaves |
|---|---|---|
| [SciSpace/Typeset](https://scispace.com/for-writers/) | Form-based metadata entry + paste section text + one "Auto Format" batch action → exports Word/LaTeX/PDF. 36+ IEEE templates. Paid ($8–70/mo advanced tiers), broad professional research suite (citations, DOI import, plagiarism check). | No live drag-and-drop block reordering; no continuously-updating paginated preview — it's a batch reformat step, not a live build experience. Heavier/paid, aimed at professional researchers rather than the quick student-paper case. |
| [Overleaf](https://www.overleaf.com/latex/templates/ieee-conference-template/grfzhhncsfqn) | Official IEEE LaTeX template hosting, compiled-PDF preview alongside code. | Requires learning LaTeX syntax — exactly the barrier non-technical students can't clear. |
| Word IEEE template (Scribbr etc.) | Static downloadable template. | 100% manual; styles break easily; no live preview, no automation. |
| Jenni AI / Writefull / Paperpal | AI writing assistance, language quality, AI-detection scoring. | Solves a different problem (content quality), not formatting; also explicitly out of scope here. |

**Our differentiation**: the only tool combining (1) genuinely live drag-and-drop block editing with an always-current paginated two-column preview, (2) zero LaTeX/Word-styles knowledge required, (3) tight scope to the student conference-paper use case, (4) free/cheap.

## 7. MVP Feature Set

### 7.1 Document structure (fixed template chrome — never user-editable)
- IEEE conference template: US Letter, 0.75in/1in/0.625in margins, two-column (88mm width, 4mm gutter), Times New Roman at prescribed point sizes per element (24/11/10/9/8/6pt), no page numbers/headers.

### 7.2 Editable content blocks (user builds/reorders these)
- **Title block**: paper title, multiple authors with affiliations.
- **Abstract**: single paragraph, ~150-word soft cap enforced in UI.
- **Keywords / Index Terms.**
- **Sections**: heading + rich-text body (bold/italic), nestable subsections, drag-to-reorder.
- **Figures**: image upload, caption below (auto Arabic numbering), drag-to-reorder/insert near citation.
- **Tables**: simple row/column editor, caption above (auto Roman numbering).
- **Equations**: MathLive input (no LaTeX syntax typed), KaTeX render, auto flush-right numbering.
- **References**: manual structured entries (author/title/venue/year), auto-numbered by first-citation-order in text, not by list position.
- **Inline citations**: `[n]` markers that auto-number and link to the matching reference entry (click-to-jump).

### 7.3 Core platform behaviors
- Live paginated preview: edits reflow across pages/columns immediately (debounced ~150–300ms).
- PDF export: identical rendering pipeline to the live preview (no separate conversion step).
- Configurable page-limit field (venue-specific, shown as a warning banner when exceeded — not hardcoded).
- Auth + save/load documents (single-owner).

## 8. Non-Functional Requirements

- **Fidelity**: exported PDF must match the live preview exactly — verified by measuring margins/column widths against spec in a PDF viewer.
- **Browser support**: Chromium-based browsers only for guaranteed pagination fidelity (Firefox/Safari CSS Paged Media support differs too much to promise pixel parity).
- **Font licensing**: genuine Times New Roman (not a metric-substitute font) required server-side for export rendering, to avoid line-wrap drift.
- **Numbering integrity**: figure/table/citation numbers are always derived at render time from current block order — never persisted as static text — so reordering/deleting blocks never leaves stale numbers.

## 9. Known Limitations (accepted, communicated to users)

- No automatic float placement — figures/tables render in document order; the user manually drags them near their citation. The tool won't auto-optimize position the way LaTeX does.
- Widow/orphan control is CSS best-effort (with a heading break-after rule + a post-layout fix-up pass), not a hard guarantee.
- Oversized figures need a size guardrail at upload time rather than automatic shrink-to-fit.

## 10. Success Metrics

- Time from "content ready" to "correctly formatted PDF" reduced from hours (manual Word/LaTeX) to minutes.
- Zero manual formatting edits needed post-export for a standard single-figure/single-table paper.
- Adoption: real usage by students beyond Shikha herself (e.g., classmates' mini/major project papers) as the first validation signal.

## 11. Technical Approach (summary — see architecture plan for full detail)

- **Pagination/rendering**: Paged.js (CSS Paged Media) on a live React-rendered DOM.
- **PDF export**: headless Chromium (Playwright) printing the identical DOM used for preview.
- **Frontend**: Vite + React + TypeScript, dnd-kit (block reordering), TipTap (inline rich text), MathLive/KaTeX (equations), Zod (schema validation).
- **Backend**: Supabase (auth, Postgres/JSONB document storage, Storage for images) + a narrow dedicated Node/Playwright microservice solely for PDF export.

## 12. Roadmap (see plan file for full milestone detail)

1. Static IEEE render + PDF export proof-of-concept (highest-risk milestone, tackled first).
2. Editable block model (no drag-and-drop yet).
3. Drag-and-drop reordering (dnd-kit).
4. Rich text + citation auto-numbering (TipTap).
5. Figures/tables/image upload.
6. Auth + save/load (Supabase).
7. Polish, page-limit warnings, second template as a proof the template concept generalizes.

## 13. Open Questions / Future Phases

- AI-assisted content generation and AI-detection-score testing — deferred, to be scoped separately once the core formatting product is validated.
- Journal/Transactions template support — candidate for post-MVP once conference template is proven.
- Whether to pursue a LaTeX (`IEEEtran.cls`) export path as an optional stretch format for venues that require it.
