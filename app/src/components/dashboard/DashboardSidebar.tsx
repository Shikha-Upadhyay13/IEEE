import { Link, useLocation } from "react-router-dom";

const NAV_ITEMS = [
  { to: "/dashboard", icon: "📄", label: "My Papers" },
  { to: "/assistant", icon: "✨", label: "AI Assistant" },
  { to: "/images", icon: "🖼️", label: "Images" },
];

export function DashboardSidebar({ onSignOut }: { onSignOut: () => void }) {
  const location = useLocation();

  return (
    <div className="w-60 flex-none h-screen sticky top-0 flex flex-col bg-white border-r border-gray-200 px-3 py-4">
      <div className="flex items-center gap-2 px-2 mb-6">
        <div className="w-8 h-8 rounded-md bg-indigo-600 text-white flex items-center justify-center font-serif text-sm flex-none">
          §
        </div>
        <span className="font-semibold text-gray-900 tracking-tight text-sm">IEEE Paper Builder</span>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-indigo-50 text-indigo-700 font-medium"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-1 pt-4 border-t border-gray-100">
        <Link
          to="/settings"
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
        >
          <span className="text-base">⚙️</span> Settings
        </Link>
        <Link
          to="/profile"
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
        >
          <span className="text-base">👤</span> My account
        </Link>
        <button
          onClick={onSignOut}
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors text-left"
        >
          <span className="text-base">⏻</span> Sign out
        </button>
      </div>
    </div>
  );
}
