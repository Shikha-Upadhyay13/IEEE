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
import { ProjectBar } from "../components/assistant/ProjectBar";
import { ProjectHome } from "../components/assistant/ProjectHome";
import { MarkdownContent } from "../components/assistant/MarkdownContent";

const AI_SERVICE_URL = import.meta.env.VITE_AI_SERVICE_URL ?? "http://localhost:3002";

// imageUrl/imageError turn a turn into an image-generation result instead of
// text — image generation lives inside this same conversation/composer
// rather than a separate page, so it's saved and reloaded exactly like any
// other message.
type ChatMessage = { role: "user" | "assistant"; content: string; imageUrl?: string; imageError?: boolean };
type DocumentOption = { id: string; title: string | null };

const IMAGE_SIZE = 1024;

// Pollinations.ai is a free, keyless image API — the prompt is literally the
// URL path, so requesting the image *is* generating it. A random seed keeps
// re-running the same prompt from just returning a cached identical image.
function buildImageUrl(prompt: string, seed: number): string {
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${IMAGE_SIZE}&height=${IMAGE_SIZE}&seed=${seed}&nologo=true`;
}

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

// One-click refinements offered under the most recent reply only — the
// model already has the full conversation in context, so a short
// instruction like "Make it shorter" reads unambiguously as "redo the
// thing you just wrote" without the user having to restate anything.
const FOLLOW_UP_SUGGESTIONS = ["Make it shorter", "Make it more formal", "Simplify the language", "Continue"];

const PROJECT_SCHEMA_WARNING =
  "Project color, default paper, and instructions aren't saving — this database needs the latest migration. Run every block at the bottom of supabase/schema.sql in the Supabase SQL Editor, then reload.";

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
      {role === "user" ? "You" : "Doc Buddy"}
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
  const abortControllerRef = useRef<AbortController | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  // Whether the transcript was already scrolled to (near) the bottom right
  // before this update — read inside the scroll-follow effect below so a
  // reply streaming in doesn't yank the view back down while the user has
  // scrolled up to reread something earlier.
  const isNearBottomRef = useRef(true);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  // "Share their documents": pulling one paper's content in as context is
  // opt-in and visible (the chip below), not silently applied — the user
  // should always know whether the assistant can see their paper right now.
  const [documentOptions, setDocumentOptions] = useState<DocumentOption[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<DocumentOption | null>(null);
  const [documentContext, setDocumentContext] = useState<string | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const attachMenuRef = useRef<HTMLDivElement>(null);

  // Image generation is a mode of this same composer, not a separate page —
  // toggling it swaps what Send does (generate an image vs. stream a chat
  // reply) and what the placeholder text asks for. pendingImageIndex tracks
  // which message's <img> is still loading, the same "index into an array
  // with no stable ids" pattern insertingIndex uses below.
  const [imageMode, setImageMode] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [pendingImageIndex, setPendingImageIndex] = useState<number | null>(null);

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
  // Below md, ConversationSidebar renders as a drawer instead of a
  // permanent rail — opened from the hamburger in this page's own header.
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  // Set whenever a projects query has to fall back to legacy columns (see
  // refreshProjects/handleCreateProject) — surfaced as a visible banner
  // instead of only a console.error, since a silently-dropped color or
  // default paper just looks like "the feature doesn't work" otherwise.
  const [projectSchemaWarning, setProjectSchemaWarning] = useState<string | null>(null);
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
      .select("id, name, default_document_id, color, instructions")
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (!error) {
          setProjects(data ?? []);
          return;
        }
        // Most likely cause: one or both of the projects migrations (see
        // supabase/schema.sql) haven't been run on this database yet — fall
        // back to the columns that always exist so Projects still loads,
        // just without default paper/color/instructions until they're run.
        console.error("Failed to load projects (retrying with legacy columns only):", error);
        setProjectSchemaWarning(PROJECT_SCHEMA_WARNING);
        supabase
          .from("projects")
          .select("id, name")
          .order("created_at", { ascending: true })
          .then(({ data: legacyData, error: legacyError }) => {
            if (legacyError) {
              console.error("Failed to load projects:", legacyError);
              return;
            }
            setProjects(
              (legacyData ?? []).map((p) => ({ ...p, default_document_id: null, color: null, instructions: null }))
            );
          });
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

  // Tracks scroll position so the effect below knows whether to follow new
  // content — separate from that effect since this one only needs to attach
  // its listener once, not re-run on every message.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function handleScroll() {
      if (!el) return;
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      const nearBottom = distanceFromBottom < 120;
      isNearBottomRef.current = nearBottom;
      setShowJumpToLatest(!nearBottom);
    }
    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  function scrollToLatest(behavior: ScrollBehavior = "smooth") {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    isNearBottomRef.current = true;
    setShowJumpToLatest(false);
  }

  // Only auto-follows a growing reply while the user is already at (or near)
  // the bottom — scrolling up to reread an earlier turn is never overridden
  // by the next streamed token.
  useEffect(() => {
    if (isNearBottomRef.current) scrollToLatest();
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

  // Shared by the debounced autosave below and by every place that switches
  // away from the current chat (New chat, selecting a different
  // conversation) — those need to flush whatever the debounce timer hasn't
  // gotten to yet *before* messages gets reset, or that content is lost the
  // instant it's cleared with no save ever having happened for it. Guarded
  // by the same "already saved" reference check either way, so calling it
  // when there's nothing pending is a harmless no-op.
  async function persistConversation(
    msgs: ChatMessage[],
    convId: string | null,
    projId: string | null,
    updateActiveId: boolean
  ) {
    if (!user || msgs.length === 0 || msgs === lastSavedMessagesRef.current) return;
    const title = deriveTitle(msgs);

    if (convId) {
      const { error } = await supabase.from("conversations").update({ title, messages: msgs }).eq("id", convId);
      if (error) {
        console.error("Failed to save conversation:", error);
        return;
      }
      lastSavedMessagesRef.current = msgs;
      const now = new Date().toISOString();
      setConversations((prev) =>
        [...prev]
          .map((c) => (c.id === convId ? { ...c, title, updated_at: now } : c))
          .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      );
    } else {
      const { data, error } = await supabase
        .from("conversations")
        .insert({ owner_id: user.id, project_id: projId, title, messages: msgs })
        .select("id, title, project_id, updated_at")
        .single();
      if (error || !data) {
        console.error("Failed to create conversation:", error);
        return;
      }
      lastSavedMessagesRef.current = msgs;
      setConversations((prev) => [data, ...prev]);
      // Only when this is the live autosave for the chat still on screen —
      // a flush-before-leaving call must never redirect the id back onto a
      // conversation the user has already navigated away from.
      if (updateActiveId) setActiveConversationId(data.id);
    }
  }

  // Autosave: same debounce-then-persist shape as the paper editor's
  // autosave (see EditorPage.tsx) — waits for the conversation to pause
  // (including mid-stream token bursts, which keep resetting the timer)
  // before writing.
  const debouncedMessages = useDebouncedValue(messages, 1200);
  useEffect(() => {
    persistConversation(debouncedMessages, activeConversationId, pendingProjectId, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedMessages, user]);

  // Shared by sendMessage (appends a new user turn first) and
  // regenerateLastResponse (reuses the existing history as-is) — both just
  // need "stream a fresh assistant reply for this message history" with
  // everything else (abort wiring, error handling) identical.
  async function streamAssistantReply(nextMessages: ChatMessage[]) {
    setError(null);
    setMessages([...nextMessages, { role: "assistant", content: "" }]);
    setIsStreaming(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch(`${AI_SERVICE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
          documentContext,
          projectInstructions: activeProject?.instructions || null,
        }),
        signal: controller.signal,
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
      if (err instanceof DOMException && err.name === "AbortError") {
        // Stopped intentionally via the Stop button — keep whatever content
        // streamed in so far rather than treating it as a failure.
      } else {
        console.error("Assistant request failed:", err);
        setError("Couldn't reach the assistant — is ai-service running?");
        setMessages((prev) => prev.slice(0, -1)); // drop the empty assistant bubble
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;
    setInput("");
    await streamAssistantReply([...messages, { role: "user", content: trimmed }]);
  }

  function stopGenerating() {
    abortControllerRef.current?.abort();
  }

  // Re-runs the assistant's last reply for the same preceding history —
  // scoped to the most recent turn only (like every mainstream chat
  // product), not any earlier one, since regenerating a mid-conversation
  // reply would leave everything after it stale/contradictory anyway.
  function regenerateLastResponse() {
    if (isStreaming) return;
    const lastUserIndex = messages.map((m) => m.role).lastIndexOf("user");
    if (lastUserIndex === -1) return;
    streamAssistantReply(messages.slice(0, lastUserIndex + 1));
  }

  function copyToClipboard(text: string, index: number) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex((cur) => (cur === index ? null : cur)), 1500);
    });
  }

  function generateImage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isGeneratingImage) return;

    setError(null);
    const seed = Math.floor(Math.random() * 1_000_000_000);
    const url = buildImageUrl(trimmed, seed);
    setMessages((prev) => {
      const next: ChatMessage[] = [
        ...prev,
        { role: "user", content: trimmed },
        { role: "assistant", content: "", imageUrl: url },
      ];
      setPendingImageIndex(next.length - 1);
      return next;
    });
    setInput("");
    setIsGeneratingImage(true);
  }

  function handleImageLoaded() {
    setIsGeneratingImage(false);
    setPendingImageIndex(null);
  }

  function handleImageFailed(index: number) {
    setIsGeneratingImage(false);
    setPendingImageIndex(null);
    setError("Image generation failed — try a different prompt.");
    setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, imageError: true } : m)));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (imageMode) generateImage(input);
    else sendMessage(input);
  }

  // Accepts an explicit project id (used right after creating one, before
  // activeProjectId's state update has landed) rather than always reading
  // activeProjectId from closure — defaults to it for every other caller.
  function handleNewChat(projectId: string | null = activeProjectId) {
    // Cancel any reply still streaming into *this* chat before switching —
    // otherwise the fetch reader loop keeps running in the background after
    // messages is reset below, and its next token tries to update the last
    // element of what is now an empty array. That doesn't throw (spreading
    // undefined is legal JS), it just silently no-ops every remaining
    // token, so the tail of the reply — sometimes the whole reply, if this
    // fires early enough — vanishes into a state array nothing reads
    // anymore instead of ending up in the flush below.
    if (isStreaming) abortControllerRef.current?.abort();
    // Flush anything from the chat we're leaving that the debounce timer
    // hasn't gotten to yet — without this, a brand-new conversation that
    // was never saved (or one with a very recent turn still pending) is
    // lost the instant messages is reset below, which read as "New chat
    // vanishes my current chat" rather than what was actually happening.
    persistConversation(messages, activeConversationId, pendingProjectId, false);
    setMessages([]);
    setError(null);
    setActiveConversationId(null);
    setInsertedIndices(new Set());
    setInsertingIndex(null);
    setPendingImageIndex(null);
    setIsGeneratingImage(false);
    lastSavedMessagesRef.current = null;
    setPendingProjectId(projectId);
    // A project's whole point is "this project = this paper" — every new
    // chat started inside one picks up its default paper automatically
    // instead of starting context-less every time. Outside any project (or
    // one with no default set), this just clears context like before.
    const project = projects.find((p) => p.id === projectId);
    selectContextDocument(project?.default_document_id ?? "");
    // Explicit rather than relying solely on the focus effect above: that
    // effect only re-fires when activeConversationId actually *changes* to a
    // different value, which starting a second new chat in a row wouldn't do.
    textareaRef.current?.focus();
  }

  async function handleSelectConversation(id: string) {
    if (id === activeConversationId) return;
    // Same "cancel the in-flight stream before it writes into a reset
    // array" guard as handleNewChat, plus the same flush.
    if (isStreaming) abortControllerRef.current?.abort();
    persistConversation(messages, activeConversationId, pendingProjectId, false);
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
    setPendingImageIndex(null);
    setIsGeneratingImage(false);
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

  async function handleCreateProject(name: string, color: string) {
    if (!user) return;
    const rich = await supabase
      .from("projects")
      .insert({ owner_id: user.id, name, color })
      .select("id, name, default_document_id, color, instructions")
      .single();

    let newProject: ProjectRow | null = null;
    if (!rich.error && rich.data) {
      newProject = rich.data;
    } else {
      // Same fallback as refreshProjects — one of the projects migrations
      // likely hasn't run on this database yet.
      console.error("Failed to create project (retrying with legacy columns only):", rich.error);
      setProjectSchemaWarning(PROJECT_SCHEMA_WARNING);
      const legacy = await supabase.from("projects").insert({ owner_id: user.id, name }).select("id, name").single();
      if (legacy.error || !legacy.data) {
        console.error("Failed to create project:", legacy.error);
        return;
      }
      newProject = { ...legacy.data, default_document_id: null, color: null, instructions: null };
    }

    setProjects((prev) => [...prev, newProject as ProjectRow]);
    // Land directly in the new project's home screen — creating one with no
    // visible reaction was the actual bug report ("did not redirect"), not
    // just a missing highlight in the sidebar.
    handleSelectProject(newProject.id);
  }

  function handleSelectProject(id: string | null) {
    setActiveProjectId(id);
    handleNewChat(id);
  }

  async function handleRenameProject(id: string, name: string) {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
    const { error } = await supabase.from("projects").update({ name }).eq("id", id);
    if (error) console.error("Failed to rename project:", error);
  }

  async function handleSetProjectInstructions(id: string, instructions: string) {
    const previous = projects;
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, instructions } : p)));
    const { error } = await supabase.from("projects").update({ instructions }).eq("id", id);
    if (error) {
      console.error("Failed to set project instructions:", error);
      setProjects(previous);
    }
  }

  async function handleSetProjectDefaultPaper(id: string, documentId: string | null) {
    const previous = projects;
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, default_document_id: documentId } : p)));
    const { error } = await supabase.from("projects").update({ default_document_id: documentId }).eq("id", id);
    if (error) {
      console.error("Failed to set project default paper:", error);
      setProjects(previous);
    }
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

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;
  const activeProjectConversationCount = activeProject
    ? conversations.filter((c) => c.project_id === activeProject.id).length
    : 0;

  return (
    <div className="h-screen flex bg-[#f7f6f3] dark:bg-gray-950">
      <ConversationSidebar
        conversations={conversations}
        projects={projects}
        activeConversationId={activeConversationId}
        activeProjectId={activeProjectId}
        userEmail={user?.email ?? null}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        onNewChat={() => handleNewChat()}
        onSelectConversation={handleSelectConversation}
        onRenameConversation={handleRenameConversation}
        onDeleteConversation={handleDeleteConversation}
        onSelectProject={handleSelectProject}
        onCreateProject={handleCreateProject}
        onDeleteProject={handleDeleteProject}
        onSignOut={handleSignOut}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex-none flex items-center gap-3 px-4 sm:px-6 py-3 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open chat history"
            className="md:hidden w-8 h-8 flex-none flex items-center justify-center rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 text-lg -ml-1"
          >
            ☰
          </button>
          <Link
            to="/dashboard"
            className="text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            ← Dashboard
          </Link>
          <span className="hidden sm:inline text-gray-300 dark:text-gray-700">|</span>
          <div className="hidden sm:flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-blue-700 dark:bg-blue-600 text-white flex items-center justify-center font-serif text-xs">
              §
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-none tracking-tight">
                Doc Buddy
              </p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-none mt-0.5">
                Drafting &amp; revision support
              </p>
            </div>
          </div>
        </div>

        {projectSchemaWarning && (
          <div className="flex-none flex items-start gap-2 px-6 py-2.5 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-400">
            <span className="flex-none">⚠️</span>
            <p className="flex-1">{projectSchemaWarning}</p>
            <button
              onClick={() => setProjectSchemaWarning(null)}
              aria-label="Dismiss"
              className="flex-none hover:text-amber-950 dark:hover:text-amber-200"
            >
              ✕
            </button>
          </div>
        )}

        {activeProject && (
          <ProjectBar
            project={activeProject}
            conversationCount={activeProjectConversationCount}
            documentOptions={documentOptions}
            onRename={(name) => handleRenameProject(activeProject.id, name)}
            onSetDefaultPaper={(documentId) => handleSetProjectDefaultPaper(activeProject.id, documentId)}
            onDelete={() => handleDeleteProject(activeProject.id)}
          />
        )}

        <div className="relative flex-1 min-h-0">
        <div ref={scrollRef} className="h-full overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-5">
            {messages.length === 0 &&
              (activeProject ? (
                <ProjectHome
                  project={activeProject}
                  conversations={conversations.filter((c) => c.project_id === activeProject.id)}
                  onSelectConversation={handleSelectConversation}
                  onSetInstructions={(instructions) => handleSetProjectInstructions(activeProject.id, instructions)}
                />
              ) : (
                <div className="text-center py-12 animate-fade-in-up">
                  <div className="w-14 h-14 mx-auto mb-5 rounded-xl bg-blue-700 dark:bg-blue-600 text-white flex items-center justify-center font-serif text-3xl">
                    §
                  </div>
                  <p className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1 tracking-tight">
                    What are you writing today?
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
                    Ask for help drafting or refining any part of your paper's content — or switch to image mode
                    below to generate a figure or illustration.
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
                        <span className="flex-none font-serif text-sm text-gray-400 dark:text-gray-500 w-5">
                          {numeral}
                        </span>
                        <span className="text-sm text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100 group-hover:translate-x-0.5 transition-all">
                          {text}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}

            {messages.map((message, i) => {
              const isEmptyStreamingReply =
                message.role === "assistant" &&
                !message.content &&
                !message.imageUrl &&
                isStreaming &&
                i === messages.length - 1;
              const isLastMessage = i === messages.length - 1;
              const showAssistantActions = message.role === "assistant" && message.content && !message.imageUrl;
              const canInsert = showAssistantActions && selectedDoc && !isStreaming;
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
                    {message.imageUrl ? (
                      <div className="relative w-64 aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-800">
                        {message.imageError ? (
                          <p className="p-4 text-sm text-red-600 dark:text-red-400">
                            Image generation failed — try a different prompt.
                          </p>
                        ) : (
                          <img
                            src={message.imageUrl}
                            alt={message.content || "Generated image"}
                            onLoad={i === pendingImageIndex ? handleImageLoaded : undefined}
                            onError={i === pendingImageIndex ? () => handleImageFailed(i) : undefined}
                            className="w-full h-full object-cover"
                          />
                        )}
                        {i === pendingImageIndex && !message.imageError && (
                          <div className="absolute inset-0 flex items-center justify-center bg-gray-100/90 dark:bg-gray-800/90">
                            <div className="w-6 h-6 border-2 border-gray-300 dark:border-gray-600 border-t-gray-800 dark:border-t-gray-200 rounded-full animate-spin" />
                          </div>
                        )}
                      </div>
                    ) : message.role === "user" ? (
                      <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-gray-900 dark:text-gray-100">
                        {message.content}
                      </div>
                    ) : (
                      <div
                        className={`pl-4 py-0.5 border-l-2 border-gray-200 dark:border-gray-800 font-serif text-[15px] leading-relaxed text-gray-800 dark:text-gray-200 ${
                          isStreaming && isLastMessage && message.content
                            ? "after:content-['|'] after:inline-block after:ml-0.5 after:font-sans after:text-gray-400 dark:after:text-gray-500 after:animate-caret-blink"
                            : ""
                        }`}
                      >
                        {isEmptyStreamingReply ? (
                          <ThinkingIndicator />
                        ) : (
                          <MarkdownContent text={message.content} />
                        )}
                      </div>
                    )}
                    {message.imageUrl && !message.imageError && i !== pendingImageIndex && (
                      <a
                        href={message.imageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-gray-400 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors px-1"
                      >
                        ⬇ Open full size
                      </a>
                    )}
                    {showAssistantActions && (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => copyToClipboard(message.content, i)}
                          className="text-[11px] text-gray-400 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors px-1"
                        >
                          {copiedIndex === i ? "✓ Copied" : "⧉ Copy"}
                        </button>
                        {isLastMessage && !isStreaming && (
                          <button
                            onClick={regenerateLastResponse}
                            className="text-[11px] text-gray-400 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors px-1"
                          >
                            ↻ Regenerate
                          </button>
                        )}
                        {canInsert && (
                          <button
                            onClick={() => handleInsertIntoPaper(i, message.content)}
                            disabled={insertingIndex === i || insertedIndices.has(i)}
                            className="text-[11px] text-gray-400 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 disabled:hover:text-gray-400 dark:disabled:hover:text-gray-500 transition-colors px-1"
                          >
                            {insertedIndices.has(i)
                              ? `✓ Added to ${selectedDoc.title || "paper"}`
                              : insertingIndex === i
                                ? "Adding…"
                                : `+ Add to ${selectedDoc.title || "paper"}`}
                          </button>
                        )}
                      </div>
                    )}
                    {showAssistantActions && isLastMessage && !isStreaming && (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {FOLLOW_UP_SUGGESTIONS.map((suggestion) => (
                          <button
                            key={suggestion}
                            onClick={() => sendMessage(suggestion)}
                            className="text-[11px] text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-full px-2.5 py-1 hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {error && <p className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p>}
          </div>
        </div>

        {/* Only shown once the transcript is scrolled away from the bottom
            (see the scroll-tracking effect above) — a quiet way back down
            that doesn't fight a reader who scrolled up on purpose. */}
        {showJumpToLatest && (
          <button
            onClick={() => scrollToLatest()}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full bg-gray-900/90 dark:bg-gray-100/90 text-white dark:text-gray-900 text-xs font-medium pl-3 pr-3.5 py-1.5 shadow-lg hover:bg-gray-900 dark:hover:bg-white transition-colors animate-fade-in"
          >
            ↓ New messages
          </button>
        )}
        </div>

        <form onSubmit={handleSubmit} className="flex-none px-4 pb-5 pt-2">
          {/* A bordered compose block with its own toolbar row, not a
              rounded-pill input with floating circular icon buttons — the
              pill-plus-circle composer is the other half (with the avatar
              thread above) of what makes a page read as an AI-chat-widget
              clone on sight, independent of color or copy. */}
          <div className="max-w-3xl mx-auto rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm focus-within:border-gray-400 dark:focus-within:border-gray-600 transition-colors">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (imageMode) generateImage(input);
                  else sendMessage(input);
                }
              }}
              rows={1}
              placeholder={imageMode ? "Describe an image to generate…" : "Ask for help with your paper's content…"}
              className="w-full resize-none bg-transparent text-sm leading-relaxed px-4 pt-3 pb-1.5 focus:outline-none placeholder:text-gray-400 dark:placeholder:text-gray-600 text-gray-900 dark:text-gray-100 transition-[height] duration-100 ease-out"
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
                            ? "text-blue-700 dark:text-blue-400 font-medium"
                            : "text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {doc.title || "Untitled paper"}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setAttachMenuOpen((v) => !v)}
                    title="Attach a paper for context"
                    className={`inline-flex items-center gap-1.5 max-w-48 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                      selectedDoc
                        ? "text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40"
                        : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`}
                  >
                    <span className="flex-none">📎</span>
                    <span className="truncate">
                      {selectedDoc ? selectedDoc.title || "Untitled paper" : "Attach paper"}
                      {contextLoading && "…"}
                    </span>
                  </button>
                  {/* Image generation as a composer mode, not a separate page
                      or section — toggling it swaps what Send does. */}
                  <button
                    type="button"
                    onClick={() => setImageMode((v) => !v)}
                    title={imageMode ? "Switch back to text replies" : "Generate an image instead"}
                    className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                      imageMode
                        ? "text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40"
                        : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`}
                  >
                    🖼️ Image
                  </button>
                </div>
              </div>
              {!imageMode && isStreaming ? (
                <button
                  key="stop"
                  type="button"
                  onClick={stopGenerating}
                  className="flex-none inline-flex items-center gap-1.5 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-xs font-semibold px-3 py-1.5 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors animate-fade-in"
                >
                  <span className="w-2 h-2 bg-current" /> Stop
                </button>
              ) : (
                <button
                  key="send"
                  type="submit"
                  disabled={imageMode ? isGeneratingImage || !input.trim() : !input.trim()}
                  className="flex-none inline-flex items-center gap-1.5 rounded-md bg-blue-700 dark:bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 hover:bg-blue-800 dark:hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-700 dark:disabled:hover:bg-blue-600 transition-colors animate-fade-in"
                >
                  {imageMode ? (isGeneratingImage ? "Generating…" : "Generate") : "Send"}
                  {!isGeneratingImage && <span className="leading-none">↵</span>}
                </button>
              )}
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
