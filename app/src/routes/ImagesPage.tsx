import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { useAuth } from "../lib/useAuth";
import { ImagesSidebar } from "../components/assistant/ImagesSidebar";
import { btnPrimary } from "../lib/uiClasses";

type GeneratedImage = { id: string; prompt: string; image_url: string; created_at: string };

const STARTER_PROMPTS = [
  "A futuristic city skyline at sunset, digital art",
  "Minimalist logo of a rocket, flat design, white background",
  "A cozy reading nook with warm lighting, watercolor style",
  "Abstract network of glowing nodes, dark background",
];

const IMAGE_SIZE = 1024;

// Pollinations.ai is a free, keyless image API — the prompt is literally the
// URL path, so requesting the image *is* generating it. A random seed keeps
// re-running the same prompt from just returning a cached identical image.
function buildImageUrl(prompt: string, seed: number): string {
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${IMAGE_SIZE}&height=${IMAGE_SIZE}&seed=${seed}&nologo=true`;
}

export function ImagesPage() {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [pendingPrompt, setPendingPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<GeneratedImage | null>(null);

  useEffect(() => {
    supabase
      .from("generated_images")
      .select("id, prompt, image_url, created_at")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error("Failed to load generated images:", error);
        setImages(data ?? []);
      });
  }, []);

  function handleGenerate(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pendingUrl) return;
    setError(null);
    setPendingPrompt(trimmed);
    setPendingUrl(buildImageUrl(trimmed, Math.floor(Math.random() * 1_000_000_000)));
    setPrompt("");
  }

  async function handleImageLoaded() {
    if (!pendingUrl || !user) return;
    const { data, error } = await supabase
      .from("generated_images")
      .insert({ owner_id: user.id, prompt: pendingPrompt, image_url: pendingUrl })
      .select("id, prompt, image_url, created_at")
      .single();
    setPendingUrl(null);
    if (error || !data) {
      console.error("Failed to save generated image:", error);
      return;
    }
    setImages((prev) => [data, ...prev]);
  }

  function handleImageFailed() {
    setPendingUrl(null);
    setError("Image generation failed — try a different prompt.");
  }

  async function handleDelete(id: string) {
    const previous = images;
    setImages((prev) => prev.filter((img) => img.id !== id));
    const { error } = await supabase.from("generated_images").delete().eq("id", id);
    if (error) {
      console.error("Failed to delete image:", error);
      setImages(previous);
    }
  }

  async function handleDownload(img: GeneratedImage) {
    try {
      const response = await fetch(img.image_url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = `${img.prompt.slice(0, 40).replace(/[^a-z0-9]+/gi, "-") || "image"}.jpg`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  return (
    <div className="h-screen flex bg-gradient-to-b from-indigo-50/40 via-white to-white">
      <ImagesSidebar userEmail={user?.email ?? null} onSignOut={handleSignOut} />

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex-none flex items-center gap-3 px-6 py-3 border-b border-gray-200 bg-white/80 backdrop-blur">
          <Link to="/dashboard" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">
            ← Dashboard
          </Link>
          <span className="text-gray-300">|</span>
          <div>
            <p className="text-sm font-semibold text-gray-900 leading-none">Images</p>
            <p className="text-[11px] text-gray-400 leading-none mt-0.5">Pollinations.ai · free, no limits</p>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleGenerate(prompt);
            }}
            className="max-w-2xl mx-auto flex gap-2 items-center bg-white border border-gray-200 rounded-2xl shadow-sm px-3 py-2 mb-8 focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-400 transition-colors"
          >
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe an image to generate…"
              className="flex-1 bg-transparent text-sm py-1.5 focus:outline-none placeholder:text-gray-400"
            />
            <button type="submit" disabled={!!pendingUrl || !prompt.trim()} className={btnPrimary}>
              {pendingUrl ? "Generating…" : "Generate"}
            </button>
          </form>

          {error && <p className="text-sm text-red-600 text-center mb-4">{error}</p>}

          {images.length === 0 && !pendingUrl && (
            <div className="text-center py-8 animate-fade-in-up">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-2xl shadow-md shadow-indigo-200">
                🖼️
              </div>
              <p className="text-lg font-semibold text-gray-900 mb-1">Generate your first image</p>
              <p className="text-sm text-gray-500 mb-6">Describe anything — illustrations, icons, backgrounds.</p>
              <div className="grid sm:grid-cols-2 gap-2.5 max-w-lg mx-auto">
                {STARTER_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => handleGenerate(p)}
                    className="text-left text-sm text-gray-700 bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-indigo-300 hover:shadow-sm hover:-translate-y-0.5 transition-all"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
            {pendingUrl && (
              <div className="aspect-square rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden relative">
                <img src={pendingUrl} onLoad={handleImageLoaded} onError={handleImageFailed} className="hidden" />
                <div className="flex flex-col items-center gap-2 text-gray-400">
                  <div className="w-6 h-6 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin" />
                  <span className="text-xs px-3 text-center line-clamp-2">{pendingPrompt}</span>
                </div>
              </div>
            )}

            {images.map((img) => (
              <div
                key={img.id}
                className="group relative aspect-square rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm cursor-pointer"
                onClick={() => setPreview(img)}
              >
                <img src={img.image_url} alt={img.prompt} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2.5">
                  <p className="text-white text-xs line-clamp-2 mb-2">{img.prompt}</p>
                  <div className="flex gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(img);
                      }}
                      className="text-xs bg-white/90 hover:bg-white text-gray-800 rounded-full px-2.5 py-1"
                    >
                      ⬇ Save
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(img.id);
                      }}
                      className="text-xs bg-white/90 hover:bg-white text-red-600 rounded-full px-2.5 py-1"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {preview && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8"
          onClick={() => setPreview(null)}
        >
          <button
            onClick={() => setPreview(null)}
            aria-label="Close preview"
            className="fixed top-4 right-4 z-[60] bg-white/90 hover:bg-white rounded-full w-9 h-9 flex items-center justify-center text-gray-800"
          >
            ✕
          </button>
          <img
            src={preview.image_url}
            alt={preview.prompt}
            className="max-w-full max-h-full rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
