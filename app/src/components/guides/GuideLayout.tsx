import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { BrandMark } from "../BrandMark";
import { btnPrimary } from "../../lib/uiClasses";
import { GUIDES } from "../../lib/guides";
import { findPublicRoute } from "../../lib/seo/publicRoutes";
import { usePageMeta } from "../../lib/usePageMeta";

export function GuideLayout({ heading, intro, children }: { heading: string; intro: ReactNode; children: ReactNode }) {
  const { pathname } = useLocation();
  usePageMeta(findPublicRoute(pathname) ?? { title: heading });
  const onToolPage = GUIDES.some((g) => g.path === pathname);
  const others = onToolPage ? GUIDES.filter((g) => g.path !== pathname) : [];

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="border-b border-line bg-surface/80 backdrop-blur">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2.5">
            <BrandMark />
            <span className="font-display font-semibold tracking-tight">IEEE Paper Builder</span>
          </Link>
          <nav aria-label="Site" className="flex items-center gap-5 text-sm">
            <Link to="/guides" className="text-muted hover:text-ink transition-colors">
              Free tools
            </Link>
            <Link to="/login" className={btnPrimary}>
              Start writing
            </Link>
          </nav>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="max-w-3xl mx-auto px-6 py-12 focus:outline-none">
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight mb-4">{heading}</h1>
        <div className="text-lg text-muted leading-relaxed mb-10">{intro}</div>
        {children}

        <aside className="mt-16 rounded-lg border border-line bg-surface p-6 sm:p-8">
          <h2 className="font-display text-xl font-semibold mb-2">Writing the whole paper?</h2>
          <p className="text-muted mb-5">
            IEEE Paper Builder formats the entire paper as you write — two columns, numbered sections, figures,
            tables and citations that renumber themselves — and exports a PDF. Free, no LaTeX.
          </p>
          <Link to="/login" className={`${btnPrimary} px-5 py-2.5`}>
            Start a paper
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </aside>

        {others.length > 0 && (
          <nav aria-label="More free tools" className="mt-12">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted mb-3">More free tools</h2>
            <ul className="grid sm:grid-cols-2 gap-3">
              {others.map((g) => (
                <li key={g.path}>
                  <Link
                    to={g.path}
                    className="block rounded-md border border-line bg-surface p-4 hover:border-accent transition-colors"
                  >
                    <span className="font-medium text-ink">{g.name}</span>
                    <span className="block text-sm text-muted mt-1">{g.blurb}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </main>

      <footer className="border-t border-line py-8 text-center text-xs text-muted">
        <p>IEEE Paper Builder is an independent tool and is not affiliated with or endorsed by IEEE.</p>
        <p className="mt-2 space-x-3">
          <Link to="/terms" className="underline underline-offset-2 hover:text-ink">Terms of Service</Link>
          <span aria-hidden="true">·</span>
          <Link to="/privacy" className="underline underline-offset-2 hover:text-ink">Privacy Policy</Link>
        </p>
      </footer>
    </div>
  );
}

export function GuideSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="font-display text-2xl font-semibold tracking-tight mb-3">{title}</h2>
      <div className="space-y-3 leading-relaxed text-ink/90">{children}</div>
    </section>
  );
}
