import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { GuideLayout } from "../../components/guides/GuideLayout";
import { GUIDES } from "../../lib/guides";

export function GuidesIndexPage() {
  return (
    <GuideLayout
      heading="Free IEEE formatting tools"
      intro={
        <p>
          Small tools for the fiddly parts of an IEEE paper. They run in your browser, need no account and don't
          store what you paste.
        </p>
      }
    >
      <ul className="grid gap-4">
        {GUIDES.map((g) => (
          <li key={g.path}>
            <Link
              to={g.path}
              className="group flex items-center justify-between gap-4 rounded-lg border border-line bg-surface p-5 hover:border-accent transition-colors"
            >
              <span>
                <span className="block font-display text-lg font-semibold text-ink">{g.name}</span>
                <span className="block text-sm text-muted mt-1">{g.blurb}</span>
              </span>
              <ArrowRight size={18} className="flex-none text-muted group-hover:text-accent" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </GuideLayout>
  );
}
