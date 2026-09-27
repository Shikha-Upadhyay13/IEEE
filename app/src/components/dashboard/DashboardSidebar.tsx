import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Download, FileText, LogOut, Menu, Settings, Sparkles, UserRound, X, type LucideIcon } from "lucide-react";
import { BrandMark } from "../BrandMark";

const NAV_ITEMS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/dashboard", label: "My Papers", icon: FileText },
  { to: "/assistant", label: "Doc Buddy", icon: Sparkles },
  { to: "/downloads", label: "Downloads", icon: Download },
];

const FOOTER_ITEMS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/profile", label: "My account", icon: UserRound },
];

function navClass(active: boolean) {
  return `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
    active ? "bg-accent-soft text-accent font-medium" : "text-muted hover:bg-canvas hover:text-ink"
  }`;
}

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
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} onClick={() => setMobileOpen(false)} className={navClass(location.pathname === to)}>
              <Icon size={16} strokeWidth={1.8} className="flex-none" aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-1 pt-4 border-t border-line">
          {FOOTER_ITEMS.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} onClick={() => setMobileOpen(false)} className={navClass(location.pathname === to)}>
              <Icon size={16} strokeWidth={1.8} className="flex-none" aria-hidden="true" />
              {label}
            </Link>
          ))}
          <button
            onClick={() => {
              setMobileOpen(false);
              onSignOut();
            }}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted hover:bg-canvas hover:text-ink transition-colors text-left"
          >
            <LogOut size={16} strokeWidth={1.8} className="flex-none" aria-hidden="true" />
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
          className="w-8 h-8 flex-none flex items-center justify-center rounded-md text-muted hover:bg-canvas"
        >
          <Menu size={18} aria-hidden="true" />
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
              <X size={18} aria-hidden="true" />
            </button>
            <NavBody />
          </div>
        </div>
      )}
    </>
  );
}
