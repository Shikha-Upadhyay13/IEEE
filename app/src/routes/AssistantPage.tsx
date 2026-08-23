import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { summarizeDocumentForContext } from "../lib/summarizeDocument";
import type { Document } from "../types/document";

const AI_SERVICE_URL = import.meta.env.VITE_AI_SERVICE_URL ?? "http://localhost:3002";

type ChatMessage = { role: "user" | "assistant"; content: string };
type DocumentOption = { id: string; title: string | null };

const STARTER_PROMPTS = [
  { icon: "📝", text: "Help me write my abstract from a rough description of my project" },
  { icon: "🔬", text: "Expand my methodology section with more technical detail" },
  { icon: "📊", text: "Explain my results in clearer, more formal language" },
  { icon: "📚", text: "Suggest a related-work paragraph for my topic" },
];

// Max height (px) the input grows to before it starts scrolling internally
// instead of pushing the send button further down the page.
const INPUT_MAX_HEIGHT = 160;

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

function Avatar({ role }: { role: "user" | "assistant" }) {
  if (role === "user") {
    return (
      <div className="flex-none w-8 h-8 rounded-full bg-gray-700 text-white flex items-center justify-center text-xs font-semibold">
        You
      </div>
    );
  }
  return (
    <div className="flex-none w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center text-sm shadow-sm">
      ✨
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-1.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="animate-typing-dot w-1.5 h-1.5 rounded-full bg-gray-400"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

export function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // "Share their documents": pulling one paper's content in as context is
  // opt-in and visible (the chip below), not silently applied — the user
  // should always know whether the assistant can see their paper right now.
  const [documentOptions, setDocumentOptions] = useState<DocumentOption[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<DocumentOption | null>(null);
  const [documentContext, setDocumentContext] = useState<string | null>(null);
  const [contextLoading, setContextLoading] = useState(false);

  useEffect(() => {
    supabase
      .from("documents")
      .select("id, title, updated_at")
      .order("updated_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error("Failed to load documents for context picker:", error);
        setDocumentOptions(data ?? []);
      });
  }, []);

  async function selectContextDocument(id: string) {
    if (!id) {
      setSelectedDoc(null);
      setDocumentContext(null);
      return;
    }
    const option = documentOptions.find((d) => d.id === id) ?? null;
    setSelectedDoc(option);
    setContextLoading(true);
    const { data, error } = await supabase.from("documents").select("content").eq("id", id).single();
    setContextLoading(false);
    if (error || !data) {
      console.error("Failed to load document for context:", error);
      setDocumentContext(null);
      return;
    }
    setDocumentContext(summarizeDocumentForContext(data.content as Document));
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Auto-grow the textarea with content (up to a cap) instead of either a
  // fixed one-line box that hides what you just typed, or a native resize
  // handle that looks out of place next to a chat send button.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, INPUT_MAX_HEIGHT)}px`;
  }, [input]);

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
        body: JSON.stringify({ messages: nextMessages, documentContext }),
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

  function handleNewChat() {
    setMessages([]);
    setError(null);
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-b from-indigo-50/40 via-white to-white">
      <div className="flex-none flex items-center gap-3 px-6 py-3 border-b border-gray-200 bg-white/80 backdrop-blur">
        <Link to="/dashboard" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">
          ← Dashboard
        </Link>
        <span className="text-gray-300">|</span>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-[11px]">
            ✨
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 leading-none">AI Assistant</p>
            <p className="text-[11px] text-gray-400 leading-none mt-0.5">Groq · GPT-OSS 120B</p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={handleNewChat}
              className="text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded-full px-3 py-1.5 transition-colors"
            >
              + New chat
            </button>
          )}
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full pl-2.5 pr-1 py-1">
            <span className="text-xs">📄</span>
            <select
              value={selectedDoc?.id ?? ""}
              onChange={(e) => selectContextDocument(e.target.value)}
              disabled={contextLoading}
              className="bg-transparent text-xs text-gray-600 max-w-[160px] focus:outline-none cursor-pointer"
            >
              <option value="">No paper context</option>
              {documentOptions.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.title || "Untitled paper"}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {selectedDoc && (
        <div className="flex-none flex items-center gap-2 px-6 py-1.5 bg-indigo-50 border-b border-indigo-100 text-xs text-indigo-700">
          <span>
            Using context from <strong>{selectedDoc.title || "Untitled paper"}</strong>
            {contextLoading && "…"}
          </span>
          <button
            onClick={() => selectContextDocument("")}
            className="text-indigo-400 hover:text-indigo-700 ml-auto"
            aria-label="Clear paper context"
          >
            ✕
          </button>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-5">
          {messages.length === 0 && (
            <div className="text-center py-12 animate-fade-in-up">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-2xl shadow-md shadow-indigo-200">
                ✨
              </div>
              <p className="text-lg font-semibold text-gray-900 mb-1">What are you writing today?</p>
              <p className="text-sm text-gray-500 mb-6">
                Ask for help drafting or refining any part of your paper's content.
              </p>
              <div className="grid sm:grid-cols-2 gap-2.5 max-w-lg mx-auto">
                {STARTER_PROMPTS.map(({ icon, text }) => (
                  <button
                    key={text}
                    onClick={() => sendMessage(text)}
                    className="flex items-start gap-2.5 text-left text-sm text-gray-700 bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-indigo-300 hover:shadow-sm hover:-translate-y-0.5 transition-all"
                  >
                    <span className="text-base">{icon}</span>
                    <span>{text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message, i) => {
            const isEmptyStreamingReply =
              message.role === "assistant" && !message.content && isStreaming && i === messages.length - 1;
            return (
              <div
                key={i}
                className={`flex gap-3 animate-fade-in-up ${message.role === "user" ? "flex-row-reverse" : ""}`}
              >
                <Avatar role={message.role} />
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    message.role === "user"
                      ? "bg-indigo-600 text-white rounded-br-sm"
                      : "bg-white border border-gray-200 text-gray-800 shadow-sm rounded-bl-sm"
                  }`}
                >
                  {isEmptyStreamingReply ? <TypingDots /> : message.content}
                </div>
              </div>
            );
          })}

          {error && <p className="text-sm text-red-600 text-center">{error}</p>}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex-none px-4 pb-5 pt-2">
        <div className="max-w-3xl mx-auto flex gap-2 items-end bg-white border border-gray-200 rounded-2xl shadow-sm px-3 py-2 focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-400 transition-colors">
          <textarea
            ref={textareaRef}
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
            className="flex-1 resize-none bg-transparent text-sm leading-relaxed py-1.5 focus:outline-none placeholder:text-gray-400"
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            aria-label="Send message"
            className="flex-none w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 disabled:opacity-40 disabled:hover:bg-indigo-600 transition-colors"
          >
            {isStreaming ? (
              <span className="w-3.5 h-3.5 rounded-sm bg-white" />
            ) : (
              <span className="text-base leading-none -mt-0.5">↑</span>
            )}
          </button>
        </div>
        <p className="text-center text-[11px] text-gray-400 mt-2">
          AI can be wrong — review anything you paste into your paper.
        </p>
      </form>
    </div>
  );
}
