import { useState, type ReactNode, type SVGProps } from "react";
import { Link, useLocation } from "react-router-dom";
import { BrandMark } from "../BrandMark";

function NavGlyph({ children, ...props }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4 flex-none"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

const NAV_ITEMS = [
  {
    to: "/dashboard",
    label: "My Papers",
    icon: (
      <NavGlyph>
        <rect x="5" y="3.5" width="14" height="17" rx="1.5" />
        <path d="M8.5 8h7M8.5 12h7M8.5 16h4" />
      </NavGlyph>
    ),
  },
  {
    to: "/assistant",
    label: "Doc Buddy",
    icon: (
      <NavGlyph>
        <path d="M12 3.5l1.4 4.2L18 9l-4.6 1.3L12 14.5l-1.4-4.2L6 9l4.6-1.3z" />
        <path d="M6.5 16.5l.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7z" />
      </NavGlyph>
    ),
  },
  {
    to: "/downloads",
    label: "Downloads",
    icon: (
      <NavGlyph>
        <path d="M12 4v11" />
        <path d="M8 11.5l4 4 4-4" />
        <path d="M5 19.5h14" />
      </NavGlyph>
    ),
  },
];

export function DashboardSidebar({ onSignOut }: { onSignOut: () => void }) {
  const location = useLocation();
  // Below md there's no room for a permanent 240px column (see the mobile
  // audit — it left ~135px for the entire page), so the same nav collapses
  // into a hamburger-triggered drawer instead of trying to shrink in place.
  const [mobileOpen, setMobileOpen] = useState(false);

  function NavBody() {
    return (
      <>
        <div className="flex items-center gap-2 px-2 mb-6">
          <BrandMark />
          <span className="font-display font-semibold text-ink tracking-tight text-sm">
            IEEE Paper Builder
          </span>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-accent-soft text-accent font-medium"
                    : "text-muted hover:bg-canvas hover:text-ink"
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-1 pt-4 border-t border-line">
          <Link
            to="/settings"
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
              location.pathname === "/settings"
                ? "bg-accent-soft text-accent font-medium"
                : "text-muted hover:bg-canvas hover:text-ink"
            }`}
          >
            <NavGlyph>
              <circle cx="12" cy="12" r="3" />
              <path d="M12 3.5v2.2M12 18.3v2.2M4.8 6.5l1.6 1.6M17.6 15.9l1.6 1.6M3.5 12h2.2M18.3 12h2.2M4.8 17.5l1.6-1.6M17.6 8.1l1.6-1.6" />
            </NavGlyph>
            Settings
          </Link>
          <Link
            to="/profile"
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
              location.pathname === "/profile"
                ? "bg-accent-soft text-accent font-medium"
                : "text-muted hover:bg-canvas hover:text-ink"
            }`}
          >
            <NavGlyph>
              <circle cx="12" cy="8.5" r="3" />
              <path d="M5.5 19.5c1.4-3 3.7-4.5 6.5-4.5s5.1 1.5 6.5 4.5" />
            </NavGlyph>
            My account
          </Link>
          <button
            onClick={() => {
              setMobileOpen(false);
              onSignOut();
            }}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted hover:bg-canvas hover:text-ink transition-colors text-left"
          >
            <NavGlyph>
              <path d="M10 12h9" />
              <path d="M16 8.5l3.5 3.5L16 15.5" />
              <path d="M13 5H7.5A2.5 2.5 0 005 7.5v9A2.5 2.5 0 007.5 19H13" />
            </NavGlyph>
            Sign out
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Mobile top bar — replaces the permanent column below md. */}
      <div className="md:hidden flex-none flex items-center gap-3 px-4 py-3 bg-surface border-b border-line">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="w-8 h-8 flex-none flex items-center justify-center rounded-md text-muted hover:bg-canvas text-lg"
        >
          ☰
        </button>
        <BrandMark size="sm" />
        <span className="font-display font-semibold text-ink tracking-tight text-sm truncate">
          IEEE Paper Builder
        </span>
      </div>

      {/* Desktop sidebar — unchanged from before, just hidden below md. */}
      <div className="hidden md:flex w-60 flex-none h-screen sticky top-0 flex-col bg-surface border-r border-line px-3 py-4">
        <NavBody />
      </div>

      {/* Mobile drawer, opened by the hamburger above. */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div
            className="absolute inset-0 bg-ink/40 animate-fade-in"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="relative w-72 max-w-[85%] h-full flex flex-col bg-surface px-3 py-4 shadow-xl">
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="self-end w-8 h-8 flex-none flex items-center justify-center rounded-md text-muted hover:bg-canvas mb-2"
            >
              ✕
            </button>
            <NavBody />
          </div>
        </div>
      )}
    </>
  );
}
