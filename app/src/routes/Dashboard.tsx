import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { useAuth } from "../lib/useAuth";
import { createBlankDocument } from "../lib/blankDocument";
import { btnPrimary, btnSecondary, cardBase } from "../lib/uiClasses";

type DocumentRow = { id: string; title: string | null; updated_at: string };

export function Dashboard() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data, error } = await supabase
        .from("documents")
        .select("id, title, updated_at")
        .order("updated_at", { ascending: false });
      if (!cancelled) {
        if (error) console.error("Failed to load documents:", error);
        setDocuments(data ?? []);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreate() {
    if (!user) return;
    setCreating(true);
    const blank = createBlankDocument();
    const { data, error } = await supabase
      .from("documents")
      .insert({ owner_id: user.id, title: "Untitled paper", content: blank })
      .select("id")
      .single();
    setCreating(false);
    if (error) {
      console.error("Failed to create document:", error);
      return;
    }
    navigate(`/editor/${data.id}`);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Your papers</h1>
            <p className="text-sm text-gray-500">IEEE Paper Builder</p>
          </div>
          <button onClick={handleSignOut} className={btnSecondary}>
            Sign out
          </button>
        </div>

        <button onClick={handleCreate} disabled={creating} className={`${btnPrimary} mb-6`}>
          {creating ? "Creating…" : "+ New paper"}
        </button>

        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : documents.length === 0 ? (
          <p className="text-sm text-gray-400">No papers yet — create one to get started.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {documents.map((doc) => (
              <li key={doc.id}>
                <a
                  href={`/editor/${doc.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(`/editor/${doc.id}`);
                  }}
                  className={`${cardBase} flex justify-between items-center px-4 py-3 hover:border-indigo-300 hover:shadow transition-shadow`}
                >
                  <span className="text-sm font-medium text-gray-800">
                    {doc.title || "Untitled paper"}
                  </span>
                  <span className="text-xs text-gray-400">
                    updated {new Date(doc.updated_at).toLocaleString()}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
