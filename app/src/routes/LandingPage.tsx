import { usePageMeta } from "../lib/usePageMeta";
import { findPublicRoute } from "../lib/seo/publicRoutes";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookMarked,
  Check,
  ChevronDown,
  Columns2,
  FileDown,
  GripVertical,
  History,
  Image as ImageIcon,
  Link2,
  Ruler,
  Sigma,
  X,
  type LucideIcon,
} from "lucide-react";
import { resolveNumbering } from "../lib/numbering";
import { samplePaper } from "../data/samplePaper";
import { PagedPreview } from "../components/renderer/PagedPreview";
import { btnPrimary, btnSecondary } from "../lib/uiClasses";
import { BrandMark } from "../components/BrandMark";

// The renderer produces real US-letter pages (816x1056px); this scale shrinks
// that down to a hero-sized thumbnail while keeping the aspect ratio exact.
const HERO_PAGE_SCALE = 0.56;
const HERO_PAGE_WIDTH = 816 * HERO_PAGE_SCALE;
const HERO_PAGE_HEIGHT = 600;

const COMPARISON: { task: string; word: string; builder: string }[] = [
  {
    task: "Two-column layout and margins",
    word: "Set up section breaks and columns by hand, then hope they survive edits.",
    builder: "Fixed IEEE conference template — margins, columns and font sizes are never yours to break.",
  },
  {
    task: "Moving a section",
    word: "Cut, paste, then renumber every heading, figure and table after it.",
    builder: "Drag it. Headings, figures, tables and equations renumber themselves.",
  },
  {
    task: "Citations",
    word: "Type [7] by hand; renumber everything when a new source goes in first.",
    builder: "Insert a citation from your list; numbers follow first-use order automatically.",
  },
  {
    task: "Reference formatting",
    word: "Copy author, title, venue and year into the IEEE style by hand.",
    builder: "Paste a DOI or BibTeX entry and the reference is formatted in IEEE style.",
  },
  {
    task: "Page limit",
    word: "Export, count pages, trim, repeat.",
    builder: "The top bar shows your live page count against your venue's limit.",
  },
];

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: GripVertical,
    title: "Reorder by dragging",
    body: "Sections, paragraphs, figures and tables move as blocks. A section outline lets you jump straight to the part you're working on.",
  },
  {
    icon: Columns2,
    title: "Preview that matches the PDF",
    body: "The two-column preview beside the editor is rendered by the same engine that produces your exported PDF.",
  },
  {
    icon: BookMarked,
    title: "Citations and references",
    body: "Add references by DOI lookup, BibTeX import or by hand. Citation numbers and the reference list stay in sync.",
  },
  {
    icon: Link2,
    title: "Cross-references",
    body: "Refer to Fig. 2 or Table I from your text. If the figure moves, the reference updates with it.",
  },
  {
    icon: Sigma,
    title: "Equation editor",
    body: "Build equations with a visual math keyboard or type LaTeX if you know it. Rendered with KaTeX and numbered for you.",
  },
  {
    icon: ImageIcon,
    title: "Figures and subfigures",
    body: "Upload images, group them into (a)/(b) subfigures, and choose single- or double-column width.",
  },
  {
    icon: Ruler,
    title: "Page limit warnings",
    body: "Set your venue's page limit once and see immediately when the paper runs over.",
  },
  {
    icon: History,
    title: "Autosave and version history",
    body: "Every change is saved as you type, and earlier versions can be restored from the history panel.",
  },
  {
    icon: FileDown,
    title: "PDF export",
    body: "Download a PDF of exactly what the preview shows, ready to upload to your conference's submission system.",
  },
];

const FAQS = [
  {
    q: "Is IEEE Paper Builder free?",
    a: "Yes. Creating an account, writing papers and exporting PDFs is free, and no credit card is needed.",
  },
  {
    q: "Which IEEE format does it produce?",
    a: "The IEEE conference template: US Letter or A4, two columns, Times New Roman at the sizes IEEE specifies for each element. Journal and Transactions formats are not supported yet.",
  },
  {
    q: "Will my paper be accepted if I use this?",
    a: "No tool can promise that. We handle the formatting so reviewers judge your work, not your margins. Always check your venue's call for papers for its own rules, such as page limits or blind-review requirements.",
  },
  {
    q: "Does it check my paper against IEEE PDF eXpress?",
    a: "Not yet. The exported PDF follows the conference template, but some venues require you to run it through PDF eXpress before submission — do that step on IEEE's site.",
  },
  {
    q: "Do I need to know LaTeX?",
    a: "No. You write in a normal editor. If you already know LaTeX, the equation editor accepts it directly.",
  },
  {
    q: "Can I bring references from Zotero or Google Scholar?",
    a: "Yes. Paste a DOI to look a reference up, or paste BibTeX exported from Zotero, Mendeley or Google Scholar.",
  },
  {
    q: "Where is my paper stored?",
    a: "In your account on our database, visible only to you unless you create a share link. You can delete a paper at any time from the dashboard.",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-line">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-4 text-left py-4"
      >
        <span className="text-sm font-medium text-ink">{q}</span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={`flex-none text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <p className="text-sm text-muted leading-relaxed pb-5 max-w-2xl">{a}</p>}
    </div>
  );
}

function NavBar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-20 border-b bg-surface/90 backdrop-blur transition-colors ${
        scrolled ? "border-line" : "border-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BrandMark />
          <span className="font-display font-semibold text-ink tracking-tight">IEEE Paper Builder</span>
        </div>
        <nav className="hidden sm:flex items-center gap-8 text-sm text-muted">
          <a href="#compare" className="hover:text-ink transition-colors">
            Compared to Word
          </a>
          <a href="#features" className="hover:text-ink transition-colors">
            Features
          </a>
          <a href="#faq" className="hover:text-ink transition-colors">
            FAQ
          </a>
          <Link to="/guides" className="hover:text-ink transition-colors">
            Free tools
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-sm font-medium text-muted hover:text-ink transition-colors">
            Log in
          </Link>
          <Link to="/login" className={btnPrimary}>
            Start writing
          </Link>
        </div>
      </div>
    </header>
  );
}

// The hero preview is a fixed-pixel crop of a real US-letter page; on narrow
// screens this derives a smaller scale from the wrapper's actual width so the
// page shrinks instead of being clipped.
function useHeroScale() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(HERO_PAGE_SCALE);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setScale(Math.min(HERO_PAGE_SCALE, entry.contentRect.width / 816));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { containerRef, scale };
}

export function LandingPage() {
  usePageMeta(findPublicRoute("/") ?? {});
  const resolvedSample = useMemo(() => resolveNumbering(samplePaper), []);
  const { containerRef: heroRef, scale: heroScale } = useHeroScale();

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <NavBar />

      <main id="main-content" tabIndex={-1} className="focus:outline-none">
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-20 grid lg:grid-cols-[1fr_auto] gap-14 items-center">
        <div className="min-w-0">
          <p className="text-sm font-medium text-accent mb-4">For IEEE conference papers</p>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.1] mb-5">
            Write the paper.
            <br />
            The IEEE formatting is already done.
          </h1>
          <p className="text-lg text-muted leading-relaxed mb-8 max-w-lg">
            Two columns, correct margins and fonts, numbered figures and tables, and IEEE-style citations — handled
            by a fixed template while you focus on what you're actually saying.
          </p>
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <Link to="/login" className={`${btnPrimary} px-6 py-3 text-base`}>
              Start a paper — it's free
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <a href="#compare" className={`${btnSecondary} px-5 py-3 text-base`}>
              See how it compares to Word
            </a>
          </div>
          <p className="text-sm text-muted">No credit card. No LaTeX required.</p>
        </div>

        {/* The actual renderer running in the browser, not a mockup image. */}
        <figure ref={heroRef} className="w-full min-w-0 mx-auto" style={{ maxWidth: HERO_PAGE_WIDTH }}>
          <div
            aria-hidden="true"
            inert
            className="relative mx-auto rounded-lg border border-line overflow-hidden bg-muted/20 shadow-sm"
            style={{ width: 816 * heroScale, height: HERO_PAGE_HEIGHT * (heroScale / HERO_PAGE_SCALE) }}
          >
            <div
              style={{ width: 816, transform: `scale(${heroScale})`, transformOrigin: "top left" }}
              className="pt-6 flex justify-center"
            >
              <PagedPreview document={resolvedSample} />
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-canvas to-transparent" />
          </div>
          <figcaption className="mt-3 text-xs text-muted text-center">
            The sample paper, rendered live by the same engine that exports your PDF.
          </figcaption>
        </figure>
      </section>

      <section id="compare" className="border-t border-line bg-surface">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight mb-3">
            The same paper, without the formatting chores
          </h2>
          <p className="text-muted mb-10 max-w-2xl">
            What changes when the template does the work instead of you.
          </p>
          <div className="overflow-hidden rounded-lg border border-line">
            <div className="hidden md:grid grid-cols-[1fr_1.4fr_1.4fr] bg-canvas text-xs font-semibold uppercase tracking-wide text-muted">
              <div className="px-5 py-3">Task</div>
              <div className="px-5 py-3 border-l border-line">In Word</div>
              <div className="px-5 py-3 border-l border-line">In IEEE Paper Builder</div>
            </div>
            {COMPARISON.map((row) => (
              <div key={row.task} className="grid md:grid-cols-[1fr_1.4fr_1.4fr] border-t border-line text-sm">
                <div className="px-5 pt-4 md:py-4 font-medium">{row.task}</div>
                <div className="px-5 py-2 md:py-4 md:border-l border-line flex gap-2 text-muted">
                  <X size={16} className="flex-none mt-0.5 text-red-600 dark:text-red-400" aria-label="In Word" />
                  {row.word}
                </div>
                <div className="px-5 pb-4 pt-2 md:py-4 md:border-l border-line flex gap-2">
                  <Check
                    size={16}
                    className="flex-none mt-0.5 text-emerald-600 dark:text-emerald-400"
                    aria-label="In IEEE Paper Builder"
                  />
                  {row.builder}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="border-t border-line">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight mb-3">What's included</h2>
          <p className="text-muted mb-10 max-w-2xl">Everything listed here works today.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-8">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex gap-4">
                <div className="flex-none w-9 h-9 rounded-md bg-accent-soft text-accent flex items-center justify-center">
                  <f.icon size={18} aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-1">{f.title}</h3>
                  <p className="text-sm text-muted leading-relaxed">{f.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="border-t border-line bg-surface">
        <div className="max-w-3xl mx-auto px-6 py-20">
          <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight mb-8">
            Frequently asked questions
          </h2>
          <div className="border-t border-line">
            {FAQS.map((f) => (
              <FaqItem key={f.q} q={f.q} a={f.a} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="max-w-3xl mx-auto px-6 py-20 text-center">
          <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight mb-3">
            Start with a template that's already correct
          </h2>
          <p className="text-muted mb-8">Your first paper takes about a minute to set up.</p>
          <Link to="/login" className={`${btnPrimary} px-6 py-3 text-base`}>
            Start a paper
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>
      </main>

      <footer className="border-t border-line py-8 text-center text-xs text-muted">
        <p>IEEE Paper Builder is an independent tool and is not affiliated with or endorsed by IEEE.</p>
        <p className="mt-2 space-x-3">
          <Link to="/terms" className="hover:text-ink underline underline-offset-2 transition-colors">
            Terms of Service
          </Link>
          <span aria-hidden="true">·</span>
          <Link to="/privacy" className="hover:text-ink underline underline-offset-2 transition-colors">
            Privacy Policy
          </Link>
          <span aria-hidden="true">·</span>
          <Link to="/guides" className="hover:text-ink underline underline-offset-2 transition-colors">
            Free IEEE tools
          </Link>
        </p>
      </footer>
    </div>
  );
}
