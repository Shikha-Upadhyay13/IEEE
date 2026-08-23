import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { btnPrimary } from "../lib/uiClasses";

const AI_SERVICE_URL = import.meta.env.VITE_AI_SERVICE_URL ?? "http://localhost:3002";

type ChatMessage = { role: "user" | "assistant"; content: string };

const STARTER_PROMPTS = [
  "Help me write my abstract from a rough description of my project",
  "Expand my methodology section with more technical detail",
  "Explain my results in clearer, more formal language",
  "Suggest a related-work paragraph for my topic",
];

// Groq's API is OpenAI-compatible SSE: newline-delimited `data: {...}` frames,
// terminated by a literal `data: [DONE]` — this walks the raw decoded text
// buffer for complete frames only, carrying any trailing partial frame over
// to the next chunk rather than assuming chunk boundaries line up with frames
// (they don't; a chunk can split a frame anywhere, including mid-JSON).
function extractSseFrames(buffer: string): { frames: string[]; rest: string } {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  return { frames: parts, rest };
}

export function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    setError(null);
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages([...nextMessages, { role: "assistant", content: "" }]);
    setInput("");
    setIsStreaming(true);

    try {
      const response = await fetch(`${AI_SERVICE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      if (!response.ok || !response.body) throw new Error(`Assistant request failed (${response.status})`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const { frames, rest } = extractSseFrames(buffer);
        buffer = rest;

        for (const frame of frames) {
          const line = frame.trim();
          if (!line.startsWith("data:")) continue;
          const payload = line.slice("data:".length).trim();
          if (payload === "[DONE]") continue;
          try {
            const parsed = JSON.parse(payload);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                updated[updated.length - 1] = { ...last, content: last.content + delta };
                return updated;
              });
            }
          } catch {
            // Malformed/partial frame slipping through a chunk boundary edge
            // case — drop it rather than crashing the whole stream over one
            // bad token.
          }
        }
      }
    } catch (err) {
      console.error("Assistant request failed:", err);
      setError("Couldn't reach the assistant — is ai-service running?");
      setMessages((prev) => prev.slice(0, -1)); // drop the empty assistant bubble
    } finally {
      setIsStreaming(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <div className="flex-none flex items-center gap-3 px-6 py-3 border-b border-gray-200 bg-white">
        <Link to="/dashboard" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">
          ← Dashboard
        </Link>
        <span className="text-gray-300">|</span>
        <span className="text-sm font-semibold text-gray-900">AI Assistant</span>
        <span className="text-xs text-gray-400 ml-auto">Content only — formatting stays automatic</span>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <p className="text-lg font-semibold text-gray-900 mb-1">What are you writing today?</p>
              <p className="text-sm text-gray-500 mb-6">
                Ask for help drafting or refining any part of your paper's content.
              </p>
              <div className="flex flex-col gap-2 max-w-md mx-auto">
                {STARTER_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    className="text-left text-sm text-gray-700 bg-white border border-gray-200 rounded-lg px-4 py-2.5 hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message, i) => (
            <div key={i} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  message.role === "user"
                    ? "bg-indigo-600 text-white rounded-br-sm"
                    : "bg-white border border-gray-200 text-gray-800 rounded-bl-sm"
                }`}
              >
                {message.content || (isStreaming && i === messages.length - 1 ? "…" : "")}
              </div>
            </div>
          ))}

          {error && <p className="text-sm text-red-600 text-center">{error}</p>}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex-none border-t border-gray-200 bg-white px-4 py-3">
        <div className="max-w-3xl mx-auto flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            rows={1}
            placeholder="Ask for help with your paper's content…"
            className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
          <button type="submit" disabled={isStreaming || !input.trim()} className={btnPrimary}>
            {isStreaming ? "…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
