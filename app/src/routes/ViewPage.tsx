import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { resolveNumbering } from "../lib/numbering";
import { PagedPreview } from "../components/renderer/PagedPreview";
import { supabase } from "../supabaseClient";
import { useAuth } from "../lib/useAuth";
import { btnPrimary, btnSecondary } from "../lib/uiClasses";
import { LoadingScreen } from "../components/LoadingScreen";
import { BrandMark } from "../components/BrandMark";
import { ArrowRight, FileQuestion, Lock, Pencil } from "lucide-react";
import type { Document } from "../types/document";
import { usePageMeta } from "../lib/usePageMeta";
import { parseDocument } from "../lib/parseDocument";
import type { PaperRole } from "../lib/sharing";

type SharedDocumentRow = {
  id: string;
  title: string | null;
  content: unknown;
  is_public: boolean;
  is_owner: boolean | null;
  role: PaperRole | null;
};

export function ViewPage() {
  const { documentId } = useParams<{ documentId: string }>();
  const { user } = useAuth();

  const [paperContent, setPaperContent] = useState<Document | null>(null);
  const [paperTitle, setPaperTitle] = useState<string>("IEEE Paper");
  const [role, setRole] = useState<PaperRole | null>(null);
  const canEdit = role === "owner" || role === "editor";
  const [loadState, setLoadState] = useState<"loading" | "ready" | "unauthorized" | "notfound">("loading");
  usePageMeta({
    title: loadState === "ready" ? paperTitle : "Shared paper",
    description: "A paper written and formatted in IEEE conference style with IEEE Paper Builder.",
    noindex: true,
  });

  useEffect(() => {
    if (!documentId) return;
    let cancelled = false;

    async function load() {
      setLoadState("loading");
      try {
        // Returns the paper only if it's shared or the caller owns it, so a
        // private paper and a missing one are indistinguishable here.
        const { data: rows, error } = await supabase.rpc("get_shared_document", { doc_id: documentId });

        if (cancelled) return;

        const data = (rows as SharedDocumentRow[] | null)?.[0];
        if (error || !data) {
          setLoadState(error ? "notfound" : "unauthorized");
          return;
        }

        const parsed = parseDocument(data.content);
        if (!parsed.ok) {
          console.error("Shared paper failed validation:", parsed.error);
          setLoadState("notfound");
          return;
        }
        setRole(data.is_owner ? "owner" : data.role);
        setPaperTitle(data.title || "Untitled IEEE Paper");
        setPaperContent(parsed.document);
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
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
        <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
          <Lock size={22} aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold text-ink">Paper unavailable</h2>
        <p className="text-sm text-muted max-w-md">
          This paper is private or no longer exists. If it's yours or was shared with you, sign in with that email address.
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
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
        <div className="w-12 h-12 rounded-xl bg-line text-muted flex items-center justify-center">
          <FileQuestion size={22} aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold text-ink">Paper Not Found</h2>
        <p className="text-sm text-muted max-w-md">
          This paper may have been removed or the link is invalid.
        </p>
        <Link to="/" className={btnPrimary}>
          Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      {/* Top Banner */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-8 py-2.5 bg-surface border-b border-line shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/" className="flex items-center gap-1.5 text-accent font-semibold text-sm">
            <BrandMark size="sm" />
            <span className="hidden sm:inline">IEEE Paper Builder</span>
          </Link>
          <span className="text-muted/60">|</span>
          <h1 className="text-xs sm:text-sm font-medium text-ink truncate max-w-xs sm:max-w-md">
            {paperTitle}
          </h1>
          <span className="hidden md:inline-flex text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-canvas text-muted">
            {role && !canEdit ? `Read-only · ${role}` : "Read-only"}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-none">
          {canEdit ? (
            <Link to={`/editor/${documentId}`} className={`${btnPrimary} text-xs py-1.5 px-3`}>
              <Pencil size={13} aria-hidden="true" />
              Edit Paper
            </Link>
          ) : role ? (
            <Link to="/dashboard" className={`${btnSecondary} text-xs py-1.5 px-3`}>
              Dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className={`${btnSecondary} text-xs py-1.5 px-3 hidden sm:inline-flex`}>
                Sign In
              </Link>
              <Link to="/login" className={`${btnPrimary} text-xs py-1.5 px-3`}>
                Create Your Paper
                <ArrowRight size={13} aria-hidden="true" />
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
