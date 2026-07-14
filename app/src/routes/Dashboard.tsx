import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { useAuth } from "../lib/useAuth";
import { createBlankDocument } from "../lib/blankDocument";

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
    <div style={{ maxWidth: 640, margin: "40px auto", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Your papers</h1>
        <button onClick={handleSignOut}>Sign out</button>
      </div>

      <button onClick={handleCreate} disabled={creating} style={{ marginBottom: 16 }}>
        {creating ? "Creating…" : "+ New paper"}
      </button>

      {loading ? (
        <p>Loading…</p>
      ) : documents.length === 0 ? (
        <p style={{ color: "#888" }}>No papers yet — create one to get started.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {documents.map((doc) => (
            <li key={doc.id} style={{ padding: "8px 0", borderBottom: "1px solid #eee" }}>
              <a href={`/editor/${doc.id}`} onClick={(e) => { e.preventDefault(); navigate(`/editor/${doc.id}`); }}>
                {doc.title || "Untitled paper"}
              </a>
              <span style={{ color: "#888", fontSize: 12, marginLeft: 8 }}>
                updated {new Date(doc.updated_at).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
