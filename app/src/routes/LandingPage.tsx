import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { resolveNumbering } from "../lib/numbering";
import { samplePaper } from "../data/samplePaper";
import { PagedPreview } from "../components/renderer/PagedPreview";
import { btnPrimary } from "../lib/uiClasses";

// The renderer produces real US-letter pages (816x1056px); this scale shrinks
// that down to a hero-sized thumbnail while keeping the aspect ratio exact.
const HERO_PAGE_SCALE = 0.56;
const HERO_PAGE_WIDTH = 816 * HERO_PAGE_SCALE;
const HERO_PAGE_HEIGHT = 560;

const TRUST_ITEMS = ["No credit card required", "No LaTeX to learn", "Free to start"];

const STEPS = [
  {
    n: "01",
    title: "Write your content",
    body: "Add your title, abstract, sections, figures, tables, and references in a normal, distraction-free editor.",
  },
  {
    n: "02",
    title: "Arrange with drag-and-drop",
    body: "Reorder sections and blocks visually — the fixed IEEE template underneath never breaks, no matter how you arrange it.",
  },
  {
    n: "03",
    title: "Export a ready PDF",
    body: "One click renders a submission-ready PDF from the exact same layout you've been previewing all along.",
  },
];

const FEATURES = [
  {
    icon: "⠿",
    color: "indigo",
    title: "Drag-and-drop editing",
    body: "Reorder sections, figures, and tables like building blocks — no LaTeX, no fighting Word's styles.",
  },
  {
    icon: "▤",
    color: "sky",
    title: "Live, always-accurate preview",
    body: "The two-column IEEE layout you see while editing is pixel-identical to the exported PDF — always.",
  },
  {
    icon: "❞",
    color: "amber",
    title: "Automatic citation numbering",
    body: "Cite a reference anywhere in your text; numbering, ordering, and the reference list update themselves.",
  },
  {
    icon: "∑",
    color: "violet",
    title: "Visual equation editor",
    body: "Build equations by hand with a math keyboard, no LaTeX syntax to memorize, rendered crisply with KaTeX.",
  },
  {
    icon: "🖼",
    color: "emerald",
    title: "Figures, tables & subfigures",
    body: "Upload images, arrange multi-part figures with auto (a)/(b) labels, and size/align them precisely.",
  },
  {
    icon: "⇩",
    color: "rose",
    title: "One-click PDF export",
    body: "Export a submission-ready PDF rendered from the exact same layout engine as your live preview.",
  },
];

const FEATURE_ICON_CLASSES: Record<string, string> = {
  indigo: "bg-indigo-50 text-indigo-600",
  sky: "bg-sky-50 text-sky-600",
  amber: "bg-amber-50 text-amber-600",
  violet: "bg-violet-50 text-violet-600",
  emerald: "bg-emerald-50 text-emerald-600",
  rose: "bg-rose-50 text-rose-600",
};

const FAQS = [
  {
    q: "Is IEEE Paper Builder free?",
    a: "Yes — creating an account and writing your paper is free. There's no credit card required to get started.",
  },
  {
    q: "Do I need to know LaTeX to use it?",
    a: "No. You write and organize content through a normal editor — headings, paragraphs, figures, tables, equations, references — and the app handles every formatting rule for you.",
  },
  {
    q: "Will my paper actually match the IEEE format?",
    a: "The template enforces the real IEEE conference spec — margins, two-column layout, Times New Roman sizing per element, figure/table numbering, and citation style — so you can't accidentally misformat it.",
  },
  {
    q: "Is the IEEE format the same for every paper?",
    a: "Not exactly. Conference papers and journal/Transactions papers differ in margins, page numbering, and abstract conventions, and individual venues set their own page limits. This app currently targets the IEEE conference template — the most common case for student and project papers — with per-document page limits rather than one hardcoded number.",
  },
  {
    q: "Can I add figures, tables, and equations?",
    a: "Yes. Figures support multiple images with automatic subfigure labels, tables support adjustable spacing, and equations are built visually and rendered with KaTeX.",
  },
  {
    q: "What do I get when I export?",
    a: "A PDF rendered from the exact same layout engine as your live preview, so there's no drift between what you see while editing and what you submit.",
  },
];

function GridBackdrop({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 opacity-[0.06] ${className}`}
      style={{
        backgroundImage:
          "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }}
    />
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`rounded-xl border transition-colors ${
        open ? "border-indigo-200 bg-indigo-50/40" : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-4 text-left px-5 py-4"
      >
        <span className="text-sm font-medium text-gray-900">{q}</span>
        <span
          className={`flex-none w-6 h-6 rounded-full flex items-center justify-center text-base leading-none transition-all ${
            open ? "bg-indigo-600 text-white rotate-45" : "bg-gray-100 text-gray-500"
          }`}
        >
          +
        </span>
      </button>
      {open && <p className="text-sm text-gray-500 leading-relaxed px-5 pb-4 max-w-2xl">{a}</p>}
    </div>
  );
}

function NavBar() {
  return (
    <header className="border-b border-gray-100 bg-white/80 backdrop-blur sticky top-0 z-20">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-indigo-600 to-indigo-800 text-white flex items-center justify-center font-serif text-sm shadow-sm">
            §
          </div>
          <span className="font-semibold text-gray-900 tracking-tight">IEEE Paper Builder</span>
        </div>
        <nav className="hidden sm:flex items-center gap-8 text-sm text-gray-600">
          <a href="#how-it-works" className="hover:text-gray-900 transition-colors">
            How it works
          </a>
          <a href="#features" className="hover:text-gray-900 transition-colors">
            Features
          </a>
          <a href="#faq" className="hover:text-gray-900 transition-colors">
            FAQ
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
            Login
          </Link>
          <Link to="/login" className={`${btnPrimary} shadow-sm hover:shadow`}>
            Start now
          </Link>
        </div>
      </div>
    </header>
  );
}

export function LandingPage() {
  const resolvedSample = useMemo(() => resolveNumbering(samplePaper), []);

  return (
    <div className="min-h-screen bg-white">
      <NavBar />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <GridBackdrop className="text-indigo-900" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 -right-40 w-[560px] h-[560px] rounded-full bg-gradient-to-br from-indigo-200/50 to-transparent blur-3xl"
        />
        <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-24 grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-full px-3 py-1.5 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
              Free IEEE conference paper builder
            </p>
            <h1 className="text-5xl sm:text-6xl font-semibold tracking-tight text-gray-900 leading-[1.05] mb-6">
              Write your paper.
              <br />
              <span className="bg-gradient-to-r from-indigo-600 to-indigo-500 bg-clip-text text-transparent">
                We'll handle the formatting.
              </span>
            </h1>
            <p className="text-lg text-gray-500 leading-relaxed mb-8 max-w-md">
              Drag, drop, and write your content — margins, two-column layout, fonts, figure
              numbering, and citations are handled automatically, to the real IEEE conference spec.
            </p>
            <div className="flex items-center gap-4 mb-6">
              <Link
                to="/login"
                className={`${btnPrimary} px-6 py-3 text-base shadow-md shadow-indigo-600/20 hover:shadow-lg hover:shadow-indigo-600/25 hover:-translate-y-0.5`}
              >
                Get started for free
              </Link>
              <a href="#how-it-works" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                See how it works →
              </a>
            </div>
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {TRUST_ITEMS.map((t) => (
                <li key={t} className="flex items-center gap-1.5 text-sm text-gray-500">
                  <span className="text-emerald-600">✓</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Live product preview — the actual renderer, not a mockup image.
              The renderer produces real US-letter (816x1056px) pages, so a raw
              embed would only ever show a corner of one; scale the whole page
              down to a thumbnail instead of letting the crop cut into it. */}
          <div className="relative">
            <div className="absolute -inset-6 bg-gradient-to-br from-indigo-100 via-indigo-50 to-transparent rounded-[2rem] -z-10" />
            <div
              className="relative mx-auto rounded-xl border border-gray-200 shadow-2xl shadow-indigo-900/10 overflow-hidden bg-gray-500"
              style={{ width: HERO_PAGE_WIDTH, height: HERO_PAGE_HEIGHT }}
            >
              <div
                style={{ width: 816, transform: `scale(${HERO_PAGE_SCALE})`, transformOrigin: "top left" }}
                className="pt-6 flex justify-center"
              >
                <PagedPreview document={resolvedSample} />
              </div>
              {/* Fade the crop into the container's own background instead of a
                  hard cut, so the second page reads as "more paper below", not
                  a clipping bug. */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-gray-500 to-transparent" />
            </div>

            {/* Floating badges — decorative, but truthful about what the
                product actually does (real numbering + real export). */}
            <div className="hidden sm:flex absolute -left-6 top-10 items-center gap-2 bg-white rounded-lg border border-gray-200 shadow-lg px-3 py-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-medium text-gray-700">Auto-numbered · Fig. 1, Table I, [1]</span>
            </div>
            <div className="hidden sm:flex absolute -right-4 bottom-16 items-center gap-2 bg-white rounded-lg border border-gray-200 shadow-lg px-3 py-2">
              <span className="text-xs font-medium text-gray-700">✓ Ready to export as PDF</span>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900 mb-3">
            From blank page to submission-ready, in three steps
          </h2>
          <p className="text-sm text-gray-500 max-w-xl mx-auto">
            No setup, no formatting rules to memorize — just write and arrange.
          </p>
        </div>
        <div className="grid sm:grid-cols-3 gap-8">
          {STEPS.map((s, i) => (
            <div key={s.n} className="relative">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-9 h-9 rounded-full bg-indigo-600 text-white text-sm font-semibold flex items-center justify-center">
                  {s.n}
                </span>
                {i < STEPS.length - 1 && (
                  <span className="hidden sm:block flex-1 h-px bg-gradient-to-r from-indigo-200 to-transparent" />
                )}
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">{s.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-[#f7f6f3] py-24">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900 mb-3">
            Everything you need for an IEEE paper
          </h2>
          <p className="text-sm text-gray-500 mb-12 max-w-xl">
            One fixed, spec-accurate template — you focus on content, the formatting takes care
            of itself.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group bg-white rounded-xl border border-gray-200 p-6 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 hover:border-gray-300"
              >
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg mb-4 transition-transform group-hover:scale-110 ${FEATURE_ICON_CLASSES[f.color]}`}
                >
                  {f.icon}
                </div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1.5">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="max-w-3xl mx-auto px-6 py-24">
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900 mb-10 text-center">
          Frequently asked questions
        </h2>
        <div className="flex flex-col gap-3">
          {FAQS.map((f) => (
            <FaqItem key={f.q} q={f.q} a={f.a} />
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-indigo-900 py-24">
        <GridBackdrop className="text-white" />
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white mb-4">
            Stop fighting your formatting.
          </h2>
          <p className="text-indigo-200/80 text-base mb-8 max-w-md mx-auto">
            Start your paper with a template that's already correct.
          </p>
          <Link
            to="/login"
            className={`${btnPrimary} px-7 py-3.5 text-base shadow-lg shadow-black/20 hover:-translate-y-0.5`}
          >
            Get started for free
          </Link>
        </div>
      </section>

      <footer className="py-8 text-center text-xs text-gray-400">
        IEEE Paper Builder — built for students and researchers.
      </footer>
    </div>
  );
}
