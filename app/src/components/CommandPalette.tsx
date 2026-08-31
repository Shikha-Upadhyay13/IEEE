import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { useAuth } from "../lib/useAuth";
import { useTheme, type ThemeSetting } from "../lib/useTheme";
import { createBlankDocument } from "../lib/blankDocument";
import { useDocumentStore } from "../store/documentStore";
import { extractTitleText } from "../lib/extractTitleText";
import { exportDocumentPdf } from "../lib/exportPdf";

type PaletteItem = {
  id: string;
  icon: string;
  label: string;
  hint?: string;
  run: () => void;
};

const NEXT_THEME: Record<ThemeSetting, ThemeSetting> = {
  light: "dark",
  dark: "system",
  system: "light",
};

// Global ⌘K/Ctrl+K launcher — mounted once in App.tsx, works from any page.
// One of the clearest "this is a serious tool" signals in 2026 SaaS design
// (Linear, Notion, Raycast, Vercel all ship one): jump anywhere or run a
// command without ever touching the mouse or hunting through a sidebar.
export function CommandPalette() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const document = useDocumentStore((s) => s.document);
  const appendParagraph = useDocumentStore((s) => s.appendParagraph);
  const appendSection = useDocumentStore((s) => s.appendSection);
  const appendFigure = useDocumentStore((s) => s.appendFigure);
  const appendTable = useDocumentStore((s) => s.appendTable);
  const appendEquation = useDocumentStore((s) => s.appendEquation);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [papers, setPapers] = useState<{ id: string; title: string | null }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleKeyDown(e: globalThis.KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelected(0);
    // Focus after this render has actually painted the input.
    requestAnimationFrame(() => inputRef.current?.focus());
    if (!user) return;
    supabase
      .from("documents")
      .select("id, title")
      .order("updated_at", { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        if (error) console.error("Failed to load papers for command palette:", error);
        setPapers(data ?? []);
      });
  }, [open, user]);

  async function createAndOpenPaper() {
    if (!user) return;
    const blank = createBlankDocument();
    const { data, error } = await supabase
      .from("documents")
      .insert({ owner_id: user.id, title: "Untitled paper", content: blank })
      .select("id")
      .single();
    if (error || !data) {
      console.error("Failed to create paper from command palette:", error);
      return;
    }
    navigate(`/editor/${data.id}`);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  // The palette is mounted once at the App root, outside the /editor/:id
  // route's own params — pulled from the URL directly instead. Present only
  // while actually on that page, since useDocumentStore's `document` is a
  // global singleton that would otherwise hold stale/unrelated content.
  const editorDocumentId = location.pathname.match(/^\/editor\/([^/]+)/)?.[1] ?? null;
  const editorItems: PaletteItem[] = editorDocumentId
    ? [
        { id: "insert-paragraph", icon: "¶", label: "Add paragraph", run: appendParagraph },
        { id: "insert-section", icon: "§", label: "Add section", run: appendSection },
        { id: "insert-figure", icon: "🖼️", label: "Add figure", run: appendFigure },
        { id: "insert-table", icon: "▦", label: "Add table", run: appendTable },
        { id: "insert-equation", icon: "∑", label: "Add equation", run: appendEquation },
        {
          id: "export-pdf",
          icon: "⬇",
          label: "Export PDF",
          run: () => {
            exportDocumentPdf(editorDocumentId, extractTitleText(document)).catch((err) =>
              console.error("Export failed:", err)
            );
          },
        },
      ]
    : [];

  const themeIcon = theme === "dark" ? "☀️" : theme === "light" ? "🖥️" : "🌙";
  const staticItems: PaletteItem[] = user
    ? [
        { id: "nav-dashboard", icon: "📄", label: "Go to My Papers", run: () => navigate("/dashboard") },
        { id: "nav-assistant", icon: "✨", label: "Go to AI Assistant", run: () => navigate("/assistant") },
        { id: "nav-downloads", icon: "📥", label: "Go to Downloads", run: () => navigate("/downloads") },
        { id: "nav-settings", icon: "⚙️", label: "Go to Settings", run: () => navigate("/settings") },
        { id: "nav-profile", icon: "👤", label: "Go to My Account", run: () => navigate("/profile") },
        { id: "new-paper", icon: "＋", label: "New paper", run: createAndOpenPaper },
        {
          id: "toggle-theme",
          icon: themeIcon,
          label: `Switch to ${NEXT_THEME[theme]} theme`,
          run: () => setTheme(NEXT_THEME[theme]),
        },
        { id: "sign-out", icon: "⏻", label: "Sign out", run: handleSignOut },
      ]
    : [
        { id: "nav-login", icon: "🔑", label: "Sign in", run: () => navigate("/login") },
        {
          id: "toggle-theme",
          icon: themeIcon,
          label: `Switch to ${NEXT_THEME[theme]} theme`,
          run: () => setTheme(NEXT_THEME[theme]),
        },
      ];

  const paperItems: PaletteItem[] = papers.map((p) => ({
    id: `paper-${p.id}`,
    icon: "📄",
    label: p.title || "Untitled paper",
    hint: "Open paper",
    run: () => navigate(`/editor/${p.id}`),
  }));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = [...editorItems, ...staticItems, ...paperItems];
    const matches = q ? all.filter((item) => item.label.toLowerCase().includes(q)) : all;
    return matches.slice(0, 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, papers, user, theme, editorDocumentId, document]);

  function runItem(item: PaletteItem) {
    setOpen(false);
    item.run();
  }

  function handleInputKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[selected];
      if (item) runItem(item);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/40 backdrop-blur-sm px-4"
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <span className="flex-none text-xs font-mono text-gray-400 dark:text-gray-500 border border-gray-300 dark:border-gray-700 rounded px-1.5 py-0.5">
            ⌘K
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(0);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="Search papers, jump to a page, or run a command…"
            className="flex-1 bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none"
          />
        </div>
        <div className="max-h-80 overflow-y-auto py-1.5">
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 px-4 py-6 text-center">No matches.</p>
          ) : (
            filtered.map((item, i) => (
              <button
                key={item.id}
                type="button"
                onClick={() => runItem(item)}
                onMouseEnter={() => setSelected(i)}
                className={`w-full flex items-center gap-3 px-4 py-2 text-left text-sm transition-colors ${
                  i === selected
                    ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    : "text-gray-700 dark:text-gray-300"
                }`}
              >
                <span className="flex-none w-4 text-center">{item.icon}</span>
                <span className="flex-1 truncate">{item.label}</span>
                {item.hint && <span className="text-[11px] text-gray-400 dark:text-gray-500">{item.hint}</span>}
              </button>
            ))
          )}
        </div>
        <div className="flex items-center gap-4 px-4 py-2 border-t border-gray-100 dark:border-gray-800 text-[11px] text-gray-400 dark:text-gray-500">
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
