import { Link, useLocation } from "react-router-dom";

// Hidden on the pages where it either doesn't apply (pre-auth landing/login,
// the headless /print export route) or would be redundant (the AI section's
// own pages already have the assistant one click away via their sidebar).
const HIDDEN_PREFIXES = ["/login", "/print", "/assistant"];

export function ChatLauncher() {
  const location = useLocation();
  if (location.pathname === "/" || HIDDEN_PREFIXES.some((p) => location.pathname.startsWith(p))) {
    return null;
  }

  return (
    <Link
      to="/assistant"
      aria-label="Open Doc Buddy"
      title="Doc Buddy"
      className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-accent text-accent-fg shadow-lg shadow-accent/25 hover:bg-accent-hover hover:scale-105 transition-all flex items-center justify-center"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-6 h-6"
        aria-hidden="true"
      >
        <path d="M5.5 17.5l-1.2 3.2 3.3-1.1A7.8 7.8 0 0019 12a7.5 7.5 0 10-13.2 5.1z" />
      </svg>
    </Link>
  );
}
