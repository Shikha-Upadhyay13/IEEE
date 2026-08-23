import { Link, useLocation } from "react-router-dom";

// Hidden on the pages where it either doesn't apply (pre-auth landing/login,
// the headless /print export route) or would be redundant (the assistant
// page itself doesn't need a button to open... itself).
const HIDDEN_PREFIXES = ["/login", "/print", "/assistant"];

export function ChatLauncher() {
  const location = useLocation();
  if (location.pathname === "/" || HIDDEN_PREFIXES.some((p) => location.pathname.startsWith(p))) {
    return null;
  }

  return (
    <Link
      to="/assistant"
      aria-label="Open AI writing assistant"
      title="AI writing assistant"
      className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 hover:scale-105 transition-all flex items-center justify-center text-2xl"
    >
      💬
    </Link>
  );
}
