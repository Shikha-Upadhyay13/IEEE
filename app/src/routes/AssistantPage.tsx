import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { useAuth } from "../lib/useAuth";
import { useDebouncedValue } from "../lib/useDebouncedValue";
import { summarizeDocumentForContext } from "../lib/summarizeDocument";
import { generateId } from "../lib/id";
import type { Document } from "../types/document";
import {
  ConversationSidebar,
  type ConversationRow,
  type ProjectRow,
} from "../components/assistant/ConversationSidebar";

const AI_SERVICE_URL = import.meta.env.VITE_AI_SERVICE_URL ?? "http://localhost:3002";

type ChatMessage = { role: "user" | "assistant"; content: string };
type DocumentOption = { id: string; title: string | null };

// Roman numerals rather than emoji icons — a small, deliberate nod to how
// this same app numbers IEEE sections, so even the empty state reads as
// "part of this specific product" instead of a generic AI-chat template.
const STARTER_PROMPTS = [
  { numeral: "I", text: "Help me write my abstract from a rough description of my project" },
  { numeral: "II", text: "Expand my methodology section with more technical detail" },
  { numeral: "III", text: "Explain my results in clearer, more formal language" },
  { numeral: "IV", text: "Suggest a related-work paragraph for my topic" },
];

// Max height (px) the input grows to before it starts scrolling internally
// instead of pushing the send button further down the page.
const INPUT_MAX_HEIGHT = 160;

function deriveTitle(messages: ChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user")?.content.trim();
  if (!firstUser) return "New chat";
  return firstUser.length > 48 ? `${firstUser.slice(0, 48)}…` : firstUser;
}

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

// Small-caps role labels above each turn, not per-message avatar icons —
// a row of circular avatars down the page is one of the clearest "this is
// a chat-app template" tells (ChatGPT, Claude, every clone of both). This
// reads closer to a transcript or an editor's marked-up manuscript than a
// messaging widget.
function RoleLabel({ role }: { role: "user" | "assistant" }) {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 px-0.5">
      {role === "user" ? "You" : "Assistant"}
    </span>
  );
}

// A quiet, italicized "Thinking…" in the same serif voice as the reply text
// that follows it, instead of the three-bouncing-dots indicator — that
// animation specifically is one of the most recognizable "AI is typing"
// clichés, on top of already being a chat-bubble idiom.
function ThinkingIndicator() {
  return <p className="font-serif text-[15px] italic text-gray-400 dark:text-gray-500 animate-pulse">Thinking…</p>;
}

export function AssistantPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
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
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const attachMenuRef = useRef<HTMLDivElement>(null);

  // "Add anything [an AI reply] to the paper": tracked by message index since
  // messages don't have stable ids — insertingIndex covers the async gap
  // between clicking and the Supabase round-trip finishing, insertedIndices
  // is permanent (until a new message list replaces it) so re-clicking after
  // success isn't offered.
  const [insertingIndex, setInsertingIndex] = useState<number | null>(null);
  const [insertedIndices, setInsertedIndices] = useState<Set<number>>(new Set());

  // Conversation history + projects (sidebar). `pendingProjectId` is the
  // project a *new* (not-yet-saved) chat will be filed under — it tracks
  // whichever project filter was active when "New chat" was clicked, so
  // starting a chat from inside a project keeps it there once it's saved.
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [pendingProjectId, setPendingProjectId] = useState<string | null>(null);
  const lastSavedMessagesRef = useRef<ChatMessage[] | null>(null);

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

  function refreshConversations() {
    supabase
      .from("conversations")
      .select("id, title, project_id, updated_at")
      .order("updated_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error("Failed to load conversations:", error);
        setConversations(data ?? []);
      });
  }

  function refreshProjects() {
    supabase
      .from("projects")
      .select("id, name")
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error("Failed to load projects:", error);
        setProjects(data ?? []);
      });
  }

  useEffect(() => {
    refreshConversations();
    refreshProjects();
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
    if (!attachMenuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) setAttachMenuOpen(false);
    }
    window.document.addEventListener("mousedown", handleClickOutside);
    return () => window.document.removeEventListener("mousedown", handleClickOutside);
  }, [attachMenuOpen]);

  async function handleInsertIntoPaper(index: number, content: string) {
    if (!selectedDoc) return;
    setInsertingIndex(index);
    const { data, error } = await supabase.from("documents").select("content").eq("id", selectedDoc.id).single();
    if (error || !data) {
      console.error("Failed to load paper to insert into:", error);
      setInsertingIndex(null);
      return;
    }
    const doc = data.content as Document;
    const updatedDoc: Document = {
      ...doc,
      body: [...doc.body, { type: "paragraph", id: generateId("p"), content: [{ type: "text", text: content }] }],
    };
    const { error: updateError } = await supabase
      .from("documents")
      .update({ content: updatedDoc })
      .eq("id", selectedDoc.id);
    setInsertingIndex(null);
    if (updateError) {
      console.error("Failed to insert reply into paper:", updateError);
      return;
    }
    setInsertedIndices((prev) => new Set(prev).add(index));
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Keep the composer focused by default — on first load, after a reply
  // finishes streaming (the disabled-during-streaming send button can steal
  // focus away when it re-enables), and whenever the active conversation
  // changes, so typing never requires clicking into the box first.
  useEffect(() => {
    if (!isStreaming) textareaRef.current?.focus();
  }, [isStreaming, activeConversationId]);

  // Auto-grow the textarea with content (up to a cap) instead of either a
  // fixed one-line box that hides what you just typed, or a native resize
  // handle that looks out of place next to a chat send button.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, INPUT_MAX_HEIGHT)}px`;
  }, [input]);

  // Autosave: same debounce-then-persist shape as the paper editor's
  // autosave (see EditorPage.tsx) — waits for the conversation to pause
  // (including mid-stream token bursts, which keep resetting the timer)
  // before writing, and compares against the last-saved reference so an
  // untouched conversation never re-saves itself.
  const debouncedMessages = useDebouncedValue(messages, 1200);
  useEffect(() => {
    if (!user || debouncedMessages.length === 0) return;
    if (debouncedMessages === lastSavedMessagesRef.current) return;
    const title = deriveTitle(debouncedMessages);

    if (activeConversationId) {
      supabase
        .from("conversations")
        .update({ title, messages: debouncedMessages })
        .eq("id", activeConversationId)
        .then(({ error }) => {
          if (error) {
            console.error("Failed to save conversation:", error);
            return;
          }
          lastSavedMessagesRef.current = debouncedMessages;
          const now = new Date().toISOString();
          setConversations((prev) =>
            [...prev]
              .map((c) => (c.id === activeConversationId ? { ...c, title, updated_at: now } : c))
              .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
          );
        });
    } else {
      supabase
        .from("conversations")
        .insert({ owner_id: user.id, project_id: pendingProjectId, title, messages: debouncedMessages })
        .select("id, title, project_id, updated_at")
        .single()
        .then(({ data, error }) => {
          if (error || !data) {
            console.error("Failed to create conversation:", error);
            return;
          }
          lastSavedMessagesRef.current = debouncedMessages;
          setActiveConversationId(data.id);
          setConversations((prev) => [data, ...prev]);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedMessages, user]);

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
    setActiveConversationId(null);
    setSelectedDoc(null);
    setDocumentContext(null);
    setInsertedIndices(new Set());
    setInsertingIndex(null);
    lastSavedMessagesRef.current = null;
    setPendingProjectId(activeProjectId);
    // Explicit rather than relying solely on the focus effect above: that
    // effect only re-fires when activeConversationId actually *changes* to a
    // different value, which starting a second new chat in a row wouldn't do.
    textareaRef.current?.focus();
  }

  async function handleSelectConversation(id: string) {
    if (id === activeConversationId) return;
    const { data, error } = await supabase.from("conversations").select("messages").eq("id", id).single();
    if (error || !data) {
      console.error("Failed to load conversation:", error);
      return;
    }
    setActiveConversationId(id);
    setMessages(data.messages as ChatMessage[]);
    lastSavedMessagesRef.current = data.messages as ChatMessage[];
    setError(null);
    setInsertedIndices(new Set());
    setInsertingIndex(null);
  }

  async function handleRenameConversation(id: string, title: string) {
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
    const { error } = await supabase.from("conversations").update({ title }).eq("id", id);
    if (error) console.error("Failed to rename conversation:", error);
  }

  async function handleDeleteConversation(id: string) {
    const previous = conversations;
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (id === activeConversationId) handleNewChat();
    const { error } = await supabase.from("conversations").delete().eq("id", id);
    if (error) {
      console.error("Failed to delete conversation:", error);
      setConversations(previous);
    }
  }

  async function handleCreateProject(name: string) {
    if (!user) return;
    const { data, error } = await supabase
      .from("projects")
      .insert({ owner_id: user.id, name })
      .select("id, name")
      .single();
    if (error || !data) {
      console.error("Failed to create project:", error);
      return;
    }
    setProjects((prev) => [...prev, data]);
  }

  async function handleDeleteProject(id: string) {
    const previousProjects = projects;
    const previousConversations = conversations;
    setProjects((prev) => prev.filter((p) => p.id !== id));
    // The DB's ON DELETE SET NULL handles the FK; mirror that locally so the
    // sidebar doesn't show orphaned conversations still tagged with a
    // project that no longer exists until the next full refresh.
    setConversations((prev) => prev.map((c) => (c.project_id === id ? { ...c, project_id: null } : c)));
    if (activeProjectId === id) setActiveProjectId(null);
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) {
      console.error("Failed to delete project:", error);
      setProjects(previousProjects);
      setConversations(previousConversations);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  return (
    <div className="h-screen flex bg-[#f7f6f3] dark:bg-gray-950">
      <ConversationSidebar
        conversations={conversations}
        projects={projects}
        activeConversationId={activeConversationId}
        activeProjectId={activeProjectId}
        userEmail={user?.email ?? null}
        onNewChat={handleNewChat}
        onSelectConversation={handleSelectConversation}
        onRenameConversation={handleRenameConversation}
        onDeleteConversation={handleDeleteConversation}
        onSelectProject={setActiveProjectId}
        onCreateProject={handleCreateProject}
        onDeleteProject={handleDeleteProject}
        onSignOut={handleSignOut}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex-none flex items-center gap-3 px-6 py-3 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur">
          <Link
            to="/dashboard"
            className="text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            ← Dashboard
          </Link>
          <span className="text-gray-300 dark:text-gray-700">|</span>
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-indigo-600 text-white flex items-center justify-center font-serif text-xs">
              §
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-none tracking-tight">
                Assistant
              </p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-none mt-0.5">
                Drafting &amp; revision support
              </p>
            </div>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-5">
            {messages.length === 0 && (
              <div className="text-center py-12 animate-fade-in-up">
                <div className="w-14 h-14 mx-auto mb-5 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-serif text-3xl">
                  §
                </div>
                <p className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1 tracking-tight">
                  What are you writing today?
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
                  Ask for help drafting or refining any part of your paper's content.
                </p>
                {/* Roman numerals + hairline dividers, styled like the paper's
                    own table of contents, instead of an icon-per-card grid —
                    the empty state should feel like it belongs to this app
                    specifically, not a generic prompt-suggestion widget. */}
                <div className="max-w-md mx-auto text-left border-t border-gray-200 dark:border-gray-800">
                  {STARTER_PROMPTS.map(({ numeral, text }) => (
                    <button
                      key={text}
                      onClick={() => sendMessage(text)}
                      className="group w-full flex items-baseline gap-4 py-3.5 border-b border-gray-200 dark:border-gray-800 text-left transition-colors"
                    >
                      <span className="flex-none font-serif text-sm text-indigo-400 dark:text-indigo-500 w-5">
                        {numeral}
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-300 group-hover:text-indigo-700 dark:group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all">
                        {text}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message, i) => {
              const isEmptyStreamingReply =
                message.role === "assistant" && !message.content && isStreaming && i === messages.length - 1;
              const canInsert = message.role === "assistant" && message.content && selectedDoc && !isStreaming;
              // A transcript, not a chat log: a small-caps role label above
              // each turn, then plain content below it — no avatar icons, no
              // bubble corners. User turns get a soft bordered card (still
              // sans-serif, still clearly "input"); assistant replies stay
              // spacious serif prose with a thin rule on the left, closer to
              // an annotated manuscript margin note than a message widget.
              return (
                <div
                  key={i}
                  className={`flex flex-col gap-1 animate-fade-in-up ${message.role === "user" ? "items-end" : "items-start"}`}
                >
                  <RoleLabel role={message.role} />
                  <div className={`flex flex-col gap-1.5 max-w-[85%] ${message.role === "user" ? "items-end" : "items-start"}`}>
                    <div
                      className={
                        message.role === "user"
                          ? "rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-gray-900 dark:text-gray-100"
                          : "pl-4 py-0.5 border-l-2 border-indigo-100 dark:border-indigo-900 font-serif text-[15px] leading-relaxed whitespace-pre-wrap text-gray-800 dark:text-gray-200"
                      }
                    >
                      {isEmptyStreamingReply ? <ThinkingIndicator /> : message.content}
                    </div>
                    {canInsert && (
                      <button
                        onClick={() => handleInsertIntoPaper(i, message.content)}
                        disabled={insertingIndex === i || insertedIndices.has(i)}
                        className="text-[11px] text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:hover:text-gray-400 dark:disabled:hover:text-gray-500 transition-colors px-1"
                      >
                        {insertedIndices.has(i)
                          ? `✓ Added to ${selectedDoc.title || "paper"}`
                          : insertingIndex === i
                            ? "Adding…"
                            : `+ Add to ${selectedDoc.title || "paper"}`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {error && <p className="text-sm text-red-600 text-center">{error}</p>}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-none px-4 pb-5 pt-2">
          {/* A bordered compose block with its own toolbar row, not a
              rounded-pill input with floating circular icon buttons — the
              pill-plus-circle composer is the other half (with the avatar
              thread above) of what makes a page read as an AI-chat-widget
              clone on sight, independent of color or copy. */}
          <div className="max-w-3xl mx-auto rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm focus-within:border-indigo-400 dark:focus-within:border-indigo-500 transition-colors">
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
              className="w-full resize-none bg-transparent text-sm leading-relaxed px-4 pt-3 pb-1.5 focus:outline-none placeholder:text-gray-400 dark:placeholder:text-gray-600 text-gray-900 dark:text-gray-100"
            />
            <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100 dark:border-gray-800">
              <div ref={attachMenuRef} className="relative">
                {attachMenuOpen && (
                  <div className="absolute bottom-full left-0 mb-2 w-60 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg py-1 max-h-64 overflow-y-auto z-10">
                    <button
                      onClick={() => {
                        selectContextDocument("");
                        setAttachMenuOpen(false);
                      }}
                      className="w-full text-left text-sm px-3 py-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      No paper attached
                    </button>
                    {documentOptions.length === 0 && (
                      <p className="text-xs text-gray-400 dark:text-gray-600 px-3 py-1.5">No papers yet.</p>
                    )}
                    {documentOptions.map((doc) => (
                      <button
                        key={doc.id}
                        onClick={() => {
                          selectContextDocument(doc.id);
                          setAttachMenuOpen(false);
                        }}
                        className={`w-full text-left text-sm px-3 py-1.5 truncate hover:bg-gray-50 dark:hover:bg-gray-800 ${
                          selectedDoc?.id === doc.id
                            ? "text-indigo-700 dark:text-indigo-400 font-medium"
                            : "text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {doc.title || "Untitled paper"}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setAttachMenuOpen((v) => !v)}
                  title="Attach a paper for context"
                  className={`inline-flex items-center gap-1.5 max-w-48 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                    selectedDoc
                      ? "text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50"
                      : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                >
                  <span className="flex-none">📎</span>
                  <span className="truncate">
                    {selectedDoc ? selectedDoc.title || "Untitled paper" : "Attach paper"}
                    {contextLoading && "…"}
                  </span>
                </button>
              </div>
              <button
                type="submit"
                disabled={isStreaming || !input.trim()}
                className="flex-none inline-flex items-center gap-1.5 rounded-md bg-indigo-600 text-white text-xs font-semibold px-3 py-1.5 hover:bg-indigo-700 disabled:opacity-40 disabled:hover:bg-indigo-600 transition-colors"
              >
                {isStreaming ? "Sending…" : "Send"}
                {!isStreaming && <span className="leading-none">↵</span>}
              </button>
            </div>
          </div>
          <p className="text-center text-[11px] text-gray-400 dark:text-gray-600 mt-2">
            AI can be wrong — review anything you paste into your paper.
          </p>
        </form>
      </div>
    </div>
  );
}
