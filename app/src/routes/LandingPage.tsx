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

const FEATURES = [
  {
    icon: "⠿",
    title: "Drag-and-drop editing",
    body: "Reorder sections, figures, and tables like building blocks — no LaTeX, no fighting Word's styles.",
  },
  {
    icon: "▤",
    title: "Live, always-accurate preview",
    body: "The two-column IEEE layout you see while editing is pixel-identical to the exported PDF — always.",
  },
  {
    icon: "❞",
    title: "Automatic citation numbering",
    body: "Cite a reference anywhere in your text; numbering, ordering, and the reference list update themselves.",
  },
  {
    icon: "∑",
    title: "Visual equation editor",
    body: "Build equations by hand with a math keyboard, no LaTeX syntax to memorize, rendered crisply with KaTeX.",
  },
  {
    icon: "🖼",
    title: "Figures, tables & subfigures",
    body: "Upload images, arrange multi-part figures with auto (a)/(b) labels, and size/align them precisely.",
  },
  {
    icon: "⇩",
    title: "One-click PDF export",
    body: "Export a submission-ready PDF rendered from the exact same layout engine as your live preview.",
  },
];

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

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-200 py-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-4 text-left"
      >
        <span className="text-sm font-medium text-gray-900">{q}</span>
        <span
          className={`flex-none text-indigo-600 text-lg leading-none transition-transform ${open ? "rotate-45" : ""}`}
        >
          +
        </span>
      </button>
      {open && <p className="text-sm text-gray-500 leading-relaxed mt-3 max-w-2xl">{a}</p>}
    </div>
  );
}

function NavBar() {
  return (
    <header className="border-b border-gray-100 bg-white/80 backdrop-blur sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-indigo-600 text-white flex items-center justify-center font-serif text-sm">
            §
          </div>
          <span className="font-semibold text-gray-900 tracking-tight">IEEE Paper Builder</span>
        </div>
        <nav className="hidden sm:flex items-center gap-8 text-sm text-gray-600">
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
          <Link to="/login" className={btnPrimary}>
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
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-24 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 mb-4">
            Free IEEE conference paper builder
          </p>
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-gray-900 leading-[1.1] mb-6">
            Write your paper.
            <br />
            We'll handle the formatting.
          </h1>
          <p className="text-base text-gray-500 leading-relaxed mb-8 max-w-md">
            Drag, drop, and write your content — margins, two-column layout, fonts, figure
            numbering, and citations are handled automatically, to the real IEEE conference spec.
            No LaTeX. No manual Word styling. Yes, really.
          </p>
          <div className="flex items-center gap-4">
            <Link to="/login" className={`${btnPrimary} px-5 py-3 text-base`}>
              Get started for free
            </Link>
            <a href="#features" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
              See how it works →
            </a>
          </div>
        </div>

        {/* Live product preview — the actual renderer, not a mockup image.
            The renderer produces real US-letter (816x1056px) pages, so a raw
            embed would only ever show a corner of one; scale the whole page
            down to a thumbnail instead of letting the crop cut into it. */}
        <div className="relative">
          <div className="absolute -inset-4 bg-gradient-to-br from-indigo-100 to-transparent rounded-3xl -z-10" />
          <div
            className="relative mx-auto rounded-xl border border-gray-200 shadow-xl overflow-hidden bg-gray-500"
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
              <div key={f.title} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg mb-4">
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
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900 mb-10">
          Frequently asked questions
        </h2>
        <div>
          {FAQS.map((f) => (
            <FaqItem key={f.q} q={f.q} a={f.a} />
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-gradient-to-br from-slate-900 via-indigo-950 to-indigo-900 py-20">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white mb-4">
            Stop fighting your formatting.
          </h2>
          <p className="text-indigo-200/80 text-sm mb-8 max-w-md mx-auto">
            Start your paper with a template that's already correct.
          </p>
          <Link to="/login" className={`${btnPrimary} px-6 py-3 text-base`}>
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
