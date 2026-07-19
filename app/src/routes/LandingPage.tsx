import { useMemo, useState, type MouseEvent, type ReactNode } from "react";
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

const BLOCK_LIST_MOCKUP = ["Title & authors", "Abstract", "I. Introduction", "Fig. 1 — Diagram", "References"];

const STATS = [
  { value: "2-column", label: "Exact IEEE layout, every time" },
  { value: "0", label: "Manual formatting fixes needed" },
  { value: "1-click", label: "From draft to submission PDF" },
];

/* ---------------------------------------------------------------------- */
/* Small inline icon set — plain geometric strokes, not emoji glyphs, so   */
/* the marketing page renders identically and crisply across platforms.   */
/* ---------------------------------------------------------------------- */

function IconBase({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

const Icons = {
  drag: (className: string) => (
    <IconBase className={className}>
      <circle cx="9" cy="6" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="15" cy="6" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="9" cy="18" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="15" cy="18" r="1.3" fill="currentColor" stroke="none" />
    </IconBase>
  ),
  preview: (className: string) => (
    <IconBase className={className}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
      <line x1="12" y1="3.5" x2="12" y2="20.5" />
      <line x1="6" y1="8" x2="9.5" y2="8" />
      <line x1="6" y1="11" x2="9.5" y2="11" />
      <line x1="6" y1="14" x2="9.5" y2="14" />
      <line x1="14.5" y1="8" x2="18" y2="8" />
      <line x1="14.5" y1="11" x2="18" y2="11" />
      <line x1="14.5" y1="14" x2="18" y2="14" />
    </IconBase>
  ),
  citation: (className: string) => (
    <IconBase className={className}>
      <path d="M9 4H6a1 1 0 00-1 1v14a1 1 0 001 1h3" />
      <path d="M15 4h3a1 1 0 011 1v14a1 1 0 01-1 1h-3" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </IconBase>
  ),
  equation: (className: string) => (
    <IconBase className={className}>
      <path d="M17 5H7l5.5 7L7 19h10" />
    </IconBase>
  ),
  figure: (className: string) => (
    <IconBase className={className}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="M4.5 16.5l4.2-4.2a1.5 1.5 0 012.1 0L15 16.5" />
      <path d="M13 15l1.3-1.3a1.5 1.5 0 012.1 0l3.1 3.1" />
    </IconBase>
  ),
  export: (className: string) => (
    <IconBase className={className}>
      <path d="M12 3.5v11" />
      <path d="M8 10.5l4 4 4-4" />
      <path d="M4.5 17v2a2 2 0 002 2h11a2 2 0 002-2v-2" />
    </IconBase>
  ),
  check: (className: string) => (
    <IconBase className={className}>
      <path d="M5 13l4.5 4.5L19 7" />
    </IconBase>
  ),
  arrowRight: (className: string) => (
    <IconBase className={className}>
      <path d="M5 12h13" />
      <path d="M13 6l6 6-6 6" />
    </IconBase>
  ),
};

const STEPS = [
  {
    icon: "equation" as const,
    color: "indigo",
    title: "Write your content",
    body: "Add your title, abstract, sections, figures, tables, and references in a normal, distraction-free editor.",
  },
  {
    icon: "drag" as const,
    color: "violet",
    title: "Arrange with drag-and-drop",
    body: "Reorder sections and blocks visually — the fixed IEEE template underneath never breaks, no matter how you arrange it.",
  },
  {
    icon: "export" as const,
    color: "rose",
    title: "Export a ready PDF",
    body: "One click renders a submission-ready PDF from the exact same layout you've been previewing all along.",
  },
];

const FEATURES = [
  {
    icon: "drag" as const,
    color: "indigo",
    title: "Drag-and-drop editing",
    body: "Reorder sections, figures, and tables like building blocks — no LaTeX, no fighting Word's styles.",
  },
  {
    icon: "preview" as const,
    color: "sky",
    title: "Live, always-accurate preview",
    body: "The two-column IEEE layout you see while editing is pixel-identical to the exported PDF — always.",
  },
  {
    icon: "citation" as const,
    color: "amber",
    title: "Automatic citation numbering",
    body: "Cite a reference anywhere in your text; numbering, ordering, and the reference list update themselves.",
  },
  {
    icon: "equation" as const,
    color: "violet",
    title: "Visual equation editor",
    body: "Build equations by hand with a math keyboard, no LaTeX syntax to memorize, rendered crisply with KaTeX.",
  },
  {
    icon: "figure" as const,
    color: "emerald",
    title: "Figures, tables & subfigures",
    body: "Upload images, arrange multi-part figures with auto (a)/(b) labels, and size/align them precisely.",
  },
  {
    icon: "export" as const,
    color: "rose",
    title: "One-click PDF export",
    body: "Export a submission-ready PDF rendered from the exact same layout engine as your live preview.",
  },
];

const ICON_BADGE_CLASSES: Record<string, string> = {
  indigo: "bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-indigo-500/30",
  sky: "bg-gradient-to-br from-sky-400 to-sky-600 shadow-sky-500/30",
  amber: "bg-gradient-to-br from-amber-400 to-amber-600 shadow-amber-500/30",
  violet: "bg-gradient-to-br from-violet-500 to-violet-700 shadow-violet-500/30",
  emerald: "bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-500/30",
  rose: "bg-gradient-to-br from-rose-400 to-rose-600 shadow-rose-500/30",
};

const CARD_HOVER_GLOW: Record<string, string> = {
  indigo: "hover:shadow-indigo-200/70 hover:border-indigo-200",
  sky: "hover:shadow-sky-200/70 hover:border-sky-200",
  amber: "hover:shadow-amber-200/70 hover:border-amber-200",
  violet: "hover:shadow-violet-200/70 hover:border-violet-200",
  emerald: "hover:shadow-emerald-200/70 hover:border-emerald-200",
  rose: "hover:shadow-rose-200/70 hover:border-rose-200",
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

function IconBadge({ icon, color, size = "md" }: { icon: keyof typeof Icons; color: string; size?: "md" | "lg" }) {
  const dims = size === "lg" ? "w-14 h-14" : "w-11 h-11";
  const iconDims = size === "lg" ? "w-7 h-7" : "w-5 h-5";
  return (
    <div className={`${dims} rounded-2xl flex items-center justify-center text-white shadow-lg ${ICON_BADGE_CLASSES[color]}`}>
      {Icons[icon](iconDims)}
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`rounded-2xl border transition-all ${
        open ? "border-indigo-200 bg-indigo-50/40 shadow-sm" : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-4 text-left px-6 py-4"
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
      {open && <p className="text-sm text-gray-500 leading-relaxed px-6 pb-5 max-w-2xl">{a}</p>}
    </div>
  );
}

function NavBar() {
  return (
    <header className="border-b border-gray-100 bg-white/70 backdrop-blur-md sticky top-0 z-20">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 text-white flex items-center justify-center font-serif text-sm shadow-md shadow-indigo-500/30">
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

/** The hero's product shot tilts in 3D and responds to the cursor — a cheap,
 *  high-payoff trick for making a static screenshot feel alive and premium
 *  rather than a flat pasted image. */
function TiltCard({ children }: { children: ReactNode }) {
  const [tilt, setTilt] = useState({ x: -6, y: 8 });

  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: py * -14, y: px * 14 });
  }
  function handleMouseLeave() {
    setTilt({ x: -6, y: 8 });
  }

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="transition-transform duration-300 ease-out will-change-transform"
      style={{
        transform: `perspective(1400px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        transformStyle: "preserve-3d",
      }}
    >
      {children}
    </div>
  );
}

export function LandingPage() {
  const resolvedSample = useMemo(() => resolveNumbering(samplePaper), []);

  return (
    <div className="min-h-screen bg-white">
      <NavBar />

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Colorful mesh backdrop — several saturated, softly blurred blobs
            rather than one flat tint, so the (light-mode) hero still reads
            as vivid instead of plain white. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-52 -right-40 w-[640px] h-[640px] rounded-full bg-gradient-to-br from-indigo-400/40 via-violet-300/30 to-transparent blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-20 -left-52 w-[520px] h-[520px] rounded-full bg-gradient-to-br from-sky-300/40 to-transparent blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 right-1/4 w-[420px] h-[420px] rounded-full bg-gradient-to-br from-rose-300/30 to-transparent blur-3xl"
        />

        <div className="relative max-w-[1440px] mx-auto px-6 lg:px-10 pt-20 pb-16 grid lg:grid-cols-2 gap-16 items-center">
          <div className="animate-fade-in-up">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-full px-3 py-1.5 mb-7">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
              Free IEEE conference paper builder
            </p>
            <h1 className="text-6xl sm:text-7xl font-extrabold tracking-tight text-gray-900 leading-[1.02] mb-6">
              Write your paper.
              <br />
              <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-500 bg-clip-text text-transparent">
                We'll handle the formatting.
              </span>
            </h1>
            <p className="text-lg text-gray-500 leading-relaxed mb-9 max-w-md">
              Drag, drop, and write your content — margins, two-column layout, fonts, figure
              numbering, and citations are handled automatically, to the real IEEE conference spec.
            </p>
            <div className="flex items-center gap-4 mb-7">
              <Link
                to="/login"
                className={`${btnPrimary} px-7 py-3.5 text-base shadow-lg shadow-indigo-600/30 hover:shadow-xl hover:shadow-indigo-600/40 hover:-translate-y-0.5`}
              >
                Get started for free
                {Icons.arrowRight("w-4 h-4")}
              </Link>
              <a href="#how-it-works" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                See how it works
              </a>
            </div>
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {TRUST_ITEMS.map((t) => (
                <li key={t} className="flex items-center gap-1.5 text-sm text-gray-500">
                  <span className="text-emerald-600">{Icons.check("w-4 h-4")}</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Live product preview — the actual renderer, not a mockup image.
              The renderer produces real US-letter (816x1056px) pages, so a raw
              embed would only ever show a corner of one; scale the whole page
              down to a thumbnail instead of letting the crop cut into it. */}
          <div className="relative animate-fade-in-up" style={{ animationDelay: "120ms" }}>
            <div className="absolute -inset-10 bg-gradient-to-br from-indigo-200/50 via-violet-100/40 to-rose-100/30 rounded-[3rem] -z-10 blur-2xl" />

            <TiltCard>
              <div
                className="relative mx-auto rounded-2xl border border-gray-200 shadow-2xl shadow-indigo-900/20 overflow-hidden bg-gray-500"
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
            </TiltCard>

            {/* Floating badge — truthful about what the product actually
                does (real numbering), styled like a live status chip. */}
            <div className="hidden sm:flex absolute -right-6 -top-6 items-center gap-2 bg-white rounded-xl border border-gray-200 shadow-xl px-3.5 py-2.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-medium text-gray-700">Auto-numbered · Fig. 1, Table I, [1]</span>
            </div>

            {/* Floating "your paper" block-list mockup — makes the drag-and-
                drop editing model concrete instead of only showing the output. */}
            <div className="hidden lg:block absolute -left-14 -bottom-12 w-60 bg-white rounded-2xl border border-gray-200 shadow-2xl p-3 rotate-[-2deg]">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 px-1 mb-2">Your paper</p>
              <div className="flex flex-col gap-1">
                {BLOCK_LIST_MOCKUP.map((label, i) => (
                  <div
                    key={label}
                    className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium ${
                      i === 1 ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200" : "text-gray-600"
                    }`}
                  >
                    <span className="text-gray-300">{Icons.drag("w-3.5 h-3.5")}</span>
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Stat strip — overlaps the hero/next-section boundary, a common
            "floating bar" pattern that gives the fold a confident, finished
            edge instead of just trailing off into whitespace. */}
        <div className="relative max-w-4xl mx-auto px-6">
          <div className="relative z-10 bg-white rounded-3xl border border-gray-200 shadow-2xl shadow-gray-900/10 grid grid-cols-3 divide-x divide-gray-100">
            {STATS.map((s) => (
              <div key={s.label} className="px-4 sm:px-8 py-6 text-center">
                <p className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-br from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                  {s.value}
                </p>
                <p className="text-xs sm:text-sm text-gray-500 mt-1 leading-snug">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="relative">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-10 pt-20 pb-24">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 mb-3">
              From blank page to submission-ready, in three steps
            </h2>
            <p className="text-sm text-gray-500 max-w-xl mx-auto">
              No setup, no formatting rules to memorize — just write and arrange.
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            {STEPS.map((s) => (
              <div
                key={s.title}
                className={`bg-white rounded-3xl border border-gray-200 shadow-sm p-8 transition-all hover:shadow-xl hover:-translate-y-1 ${CARD_HOVER_GLOW[s.color]}`}
              >
                <IconBadge icon={s.icon} color={s.color} size="lg" />
                <h3 className="text-base font-semibold text-gray-900 mt-6 mb-2">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative bg-gradient-to-b from-[#f7f6f3] to-[#f2f0ec] py-24">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-10">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 mb-3">
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
                className={`group bg-white rounded-3xl border border-gray-200 p-7 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1 ${CARD_HOVER_GLOW[f.color]}`}
              >
                <div className="transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3 inline-flex">
                  <IconBadge icon={f.icon} color={f.color} />
                </div>
                <h3 className="text-sm font-semibold text-gray-900 mt-5 mb-1.5">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="max-w-4xl mx-auto px-6 py-24">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 mb-10 text-center">
          Frequently asked questions
        </h2>
        <div className="flex flex-col gap-3">
          {FAQS.map((f) => (
            <FaqItem key={f.q} q={f.q} a={f.a} />
          ))}
        </div>
      </section>

      {/* Final CTA — a vivid gradient band rather than the muted neutrals
          used elsewhere, so the page ends on its highest-energy note. */}
      <section className="relative overflow-hidden py-24">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/4 w-[500px] h-[500px] rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 right-1/4 w-[500px] h-[500px] rounded-full bg-white/10 blur-3xl"
        />
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-4">
            Stop fighting your formatting.
          </h2>
          <p className="text-indigo-100 text-base mb-8 max-w-md mx-auto">
            Start your paper with a template that's already correct.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 rounded-xl bg-white text-indigo-700 font-semibold px-7 py-3.5 text-base shadow-xl shadow-black/20 hover:-translate-y-0.5 hover:shadow-2xl transition-all"
          >
            Get started for free
            {Icons.arrowRight("w-4 h-4")}
          </Link>
        </div>
      </section>

      <footer className="py-8 text-center text-xs text-gray-400">
        IEEE Paper Builder — built for students and researchers.
      </footer>
    </div>
  );
}
