import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import { supabase } from "../supabaseClient";
import { btnDanger } from "../lib/uiClasses";

export function SettingsPage() {
  const { user } = useAuth();
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);

  async function handleClearConversations() {
    if (!user) return;
    if (!window.confirm("Delete all AI Assistant conversations? This can't be undone.")) return;
    setClearing(true);
    setCleared(false);
    const { error } = await supabase.from("conversations").delete().eq("owner_id", user.id);
    setClearing(false);
    if (error) {
      console.error("Failed to clear conversations:", error);
      return;
    }
    setCleared(true);
  }

  return (
    <div className="min-h-screen bg-[#f7f6f3]">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <Link to="/dashboard" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">
          ← Dashboard
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 tracking-tight mt-6 mb-6">Settings</h1>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-4">
          <h2 className="text-base font-semibold text-gray-900 mb-1">AI Assistant</h2>
          <p className="text-sm text-gray-500 mb-4">
            Chat runs on Groq's <span className="font-mono text-xs">openai/gpt-oss-120b</span>, and image
            generation runs on Google's Gemini — both free tiers, configured server-side.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Data</h2>
          <p className="text-sm text-gray-500 mb-4">
            Remove every saved AI Assistant conversation. Your papers and generated images aren't affected.
          </p>
          <button onClick={handleClearConversations} disabled={clearing} className={btnDanger}>
            {clearing ? "Clearing…" : "Clear all conversations"}
          </button>
          {cleared && <p className="text-xs text-emerald-600 mt-2">All conversations cleared.</p>}
        </div>
      </div>
    </div>
  );
}
