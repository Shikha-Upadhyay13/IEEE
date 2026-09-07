import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { resolveNumbering } from "../lib/numbering";
import { PagedPreview } from "../components/renderer/PagedPreview";
import { supabase } from "../supabaseClient";
import { useAuth } from "../lib/useAuth";
import { btnPrimary, btnSecondary } from "../lib/uiClasses";
import { LoadingScreen } from "../components/LoadingScreen";
import type { Document } from "../types/document";

export function ViewPage() {
  const { documentId } = useParams<{ documentId: string }>();
  const { user } = useAuth();

  const [paperContent, setPaperContent] = useState<Document | null>(null);
  const [paperTitle, setPaperTitle] = useState<string>("IEEE Paper");
  const [isOwner, setIsOwner] = useState(false);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "unauthorized" | "notfound">("loading");

  useEffect(() => {
    if (!documentId) return;
    let cancelled = false;

    async function load() {
      setLoadState("loading");
      try {
        const { data, error } = await supabase
          .from("documents")
          .select("id, title, content, is_public, owner_id")
          .eq("id", documentId)
          .single();

        if (cancelled) return;

        if (error || !data) {
          setLoadState("notfound");
          return;
        }

        const isUserOwner = Boolean(user && user.id === data.owner_id);
        setIsOwner(isUserOwner);

        if (!data.is_public && !isUserOwner) {
          setLoadState("unauthorized");
          return;
        }

        setPaperTitle(data.title || "Untitled IEEE Paper");
        setPaperContent(data.content as Document);
        setLoadState("ready");
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load public view:", err);
          setLoadState("notfound");
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [documentId, user]);

  const resolvedDoc = useMemo(
    () => (paperContent ? resolveNumbering(paperContent) : null),
    [paperContent]
  );

  if (loadState === "loading") {
    return <LoadingScreen label="Loading formatted paper…" />;
  }

  if (loadState === "unauthorized") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#f7f6f3] dark:bg-gray-950 px-6 text-center">
        <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center text-2xl font-bold">
          🔒
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Private Paper</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md">
          The author has not enabled public link sharing for this paper, or you may need to sign in with an account that owns it.
        </p>
        <div className="flex items-center gap-3 mt-2">
          <Link to="/login" className={btnPrimary}>
            Sign In
          </Link>
          <Link to="/" className={btnSecondary}>
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  if (loadState === "notfound" || !resolvedDoc) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#f7f6f3] dark:bg-gray-950 px-6 text-center">
        <div className="w-12 h-12 rounded-xl bg-gray-200 dark:bg-gray-800 text-gray-500 flex items-center justify-center text-2xl font-bold">
          📄
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Paper Not Found</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md">
          This paper may have been removed or the link is invalid.
        </p>
        <Link to="/" className={btnPrimary}>
          Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#e5e5e5] dark:bg-gray-950">
      {/* Top Banner */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-8 py-2.5 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/" className="flex items-center gap-1.5 text-blue-700 dark:text-blue-400 font-bold text-sm">
            <span>⚡</span>
            <span className="hidden sm:inline">IEEE Paper Builder</span>
          </Link>
          <span className="text-gray-300 dark:text-gray-700">|</span>
          <h1 className="text-xs sm:text-sm font-medium text-gray-800 dark:text-gray-200 truncate max-w-xs sm:max-w-md">
            {paperTitle}
          </h1>
          <span className="hidden md:inline-flex text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
            Read-only
          </span>
        </div>

        <div className="flex items-center gap-2 flex-none">
          {isOwner ? (
            <Link to={`/editor/${documentId}`} className={`${btnPrimary} text-xs py-1.5 px-3`}>
              ✎ Edit Paper
            </Link>
          ) : (
            <>
              <Link to="/login" className={`${btnSecondary} text-xs py-1.5 px-3 hidden sm:inline-flex`}>
                Sign In
              </Link>
              <Link to="/login" className={`${btnPrimary} text-xs py-1.5 px-3`}>
                Create Your Paper →
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Main Preview Container */}
      <main className="flex-1 flex justify-center py-6 px-2 sm:px-6 overflow-y-auto">
        <div className="max-w-5xl w-full flex justify-center">
          <PagedPreview document={resolvedDoc} />
        </div>
      </main>
    </div>
  );
}
