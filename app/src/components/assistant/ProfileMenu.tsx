import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { LogOut, MoreHorizontal, Settings, UserRound } from "lucide-react";

export function ProfileMenu({ userEmail, onSignOut }: { userEmail: string | null; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    window.document.addEventListener("mousedown", handleClickOutside);
    return () => window.document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative flex-none border-t border-gray-800 p-3">
      {open && (
        <div className="absolute bottom-full left-3 right-3 mb-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg overflow-hidden text-sm">
          <Link
            to="/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 hover:bg-gray-700 text-gray-200 transition-colors"
          >
            <UserRound size={14} aria-hidden="true" />
            Profile
          </Link>
          <Link
            to="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 hover:bg-gray-700 text-gray-200 transition-colors"
          >
            <Settings size={14} aria-hidden="true" />
            Settings
          </Link>
          <button
            onClick={onSignOut}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-700 text-red-400 transition-colors text-left"
          >
            <LogOut size={14} aria-hidden="true" />
            Sign out
          </button>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-expanded={open}
        className="w-full flex items-center gap-2 rounded-md hover:bg-gray-800 px-1.5 py-1.5 transition-colors"
      >
        <div className="w-7 h-7 rounded-full bg-accent text-accent-fg flex items-center justify-center text-xs font-semibold flex-none">
          {userEmail?.[0]?.toUpperCase() ?? "?"}
        </div>
        <span className="flex-1 truncate text-xs text-gray-400 text-left">{userEmail}</span>
        <MoreHorizontal size={14} className="text-gray-500" aria-hidden="true" />
      </button>
    </div>
  );
}
