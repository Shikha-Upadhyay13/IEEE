import { supabase } from "../supabaseClient";
import { friendlyErrorMessage } from "./friendlyError";

export const AI_SERVICE_URL = import.meta.env.VITE_AI_SERVICE_URL ?? "http://localhost:3002";

export type AiMessage = { role: "user" | "assistant"; content: string };
export type AiTask = "edit" | "draft" | "review";

// Groq's API is OpenAI-compatible SSE: `data: {...}` frames separated by a
// blank line. A network chunk can end mid-frame, so the trailing partial
// frame is carried over to the next read.
export function extractSseFrames(buffer: string): { frames: string[]; rest: string } {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  return { frames: parts, rest };
}

export async function aiAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Streams a completion for an in-editor task; resolves with the full text. */
export async function streamAi({
  task,
  messages,
  documentContext,
  signal,
  onText,
}: {
  task: AiTask;
  messages: AiMessage[];
  documentContext?: string;
  signal?: AbortSignal;
  onText?: (textSoFar: string) => void;
}): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${AI_SERVICE_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await aiAuthHeaders()) },
      body: JSON.stringify({ task, messages, documentContext }),
      signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw err;
    throw new Error(friendlyErrorMessage(err, "Couldn't reach the writing assistant."));
  }
  if (response.status === 429) throw new Error("Too many AI requests in a short time. Wait a minute and try again.");
  if (response.status === 401) throw new Error("Your session has expired. Sign in again to use AI features.");
  if (!response.ok || !response.body) throw new Error(`The writing assistant returned an error (${response.status}).`);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
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
        const delta = JSON.parse(payload).choices?.[0]?.delta?.content;
        if (delta) {
          text += delta;
          onText?.(text);
        }
      } catch {
        // Ignore keep-alive or malformed frames.
      }
    }
  }
  return text.trim();
}
