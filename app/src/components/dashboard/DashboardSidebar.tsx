import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

// Image generation lives inside the AI Assistant's chat itself now, not as
// its own dashboard section — one nav entry gets you to everything the
// assistant can do.
const NAV_ITEMS = [
  { to: "/dashboard", icon: "📄", label: "My Papers" },
  { to: "/assistant", icon: "✨", label: "Doc Buddy" },
  { to: "/downloads", icon: "📥", label: "Downloads" },
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
          <div className="w-8 h-8 rounded-md bg-blue-700 dark:bg-blue-600 text-white flex items-center justify-center font-serif text-sm flex-none">
            §
          </div>
          <span className="font-semibold text-gray-900 dark:text-gray-100 tracking-tight text-sm">
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
                    ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 font-medium"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100"
                }`}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-1 pt-4 border-t border-gray-100 dark:border-gray-800">
          <Link
            to="/settings"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            <span className="text-base">⚙️</span> Settings
          </Link>
          <Link
            to="/profile"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            <span className="text-base">👤</span> My account
          </Link>
          <button
            onClick={() => {
              setMobileOpen(false);
              onSignOut();
            }}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 transition-colors text-left"
          >
            <span className="text-base">⏻</span> Sign out
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Mobile top bar — replaces the permanent column below md. */}
      <div className="md:hidden flex-none flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="w-8 h-8 flex-none flex items-center justify-center rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 text-lg"
        >
          ☰
        </button>
        <div className="w-6 h-6 rounded-md bg-blue-700 dark:bg-blue-600 text-white flex items-center justify-center font-serif text-xs flex-none">
          §
        </div>
        <span className="font-semibold text-gray-900 dark:text-gray-100 tracking-tight text-sm truncate">
          IEEE Paper Builder
        </span>
      </div>

      {/* Desktop sidebar — unchanged from before, just hidden below md. */}
      <div className="hidden md:flex w-60 flex-none h-screen sticky top-0 flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 px-3 py-4">
        <NavBody />
      </div>

      {/* Mobile drawer, opened by the hamburger above. */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div
            className="absolute inset-0 bg-black/40 animate-fade-in"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="relative w-72 max-w-[85%] h-full flex flex-col bg-white dark:bg-gray-900 px-3 py-4 shadow-xl">
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="self-end w-8 h-8 flex-none flex items-center justify-center rounded-md text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 mb-2"
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
