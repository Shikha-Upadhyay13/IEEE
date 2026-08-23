import { Link, useLocation } from "react-router-dom";

const SECTIONS = [
  { to: "/assistant", icon: "💬", label: "Chat" },
  { to: "/images", icon: "🖼️", label: "Images" },
];

// Sits above the section-specific content (chat history on /assistant,
// nothing extra on /images) in both left rails, so switching between the AI
// features feels like moving between tabs of one app rather than two
// unrelated pages that happen to share a color scheme.
export function AiSectionNav() {
  const location = useLocation();
  return (
    <div className="px-3 pt-3 flex flex-col gap-1">
      {SECTIONS.map((s) => {
        const active = location.pathname.startsWith(s.to);
        return (
          <Link
            key={s.to}
            to={s.to}
            className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
              active ? "bg-gray-800 text-white" : "text-gray-400 hover:bg-gray-800/60 hover:text-gray-200"
            }`}
          >
            <span className="text-sm">{s.icon}</span> {s.label}
          </Link>
        );
      })}
    </div>
  );
}
