import { Readable } from "node:stream";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";

const SYSTEM_PROMPT = `You are a writing assistant embedded in an IEEE conference paper builder. You help students and researchers draft, expand, and refine the *content* of their paper (abstracts, technical sections, explanations of their methodology/results, wording, clarity) in plain prose.

You do not know or apply IEEE's formatting rules (fonts, margins, columns, citation numbering) — the app itself guarantees that automatically, so never discuss formatting. Just write good, clear, technically sound paper content the user can paste into the relevant section themselves.

If the user shares context about their paper (title, abstract, existing section content), use it to keep your suggestions consistent with what they've already written.`;

/**
 * Streams a chat completion from Groq's OpenAI-compatible API back to the
 * caller as a raw Node Readable of Server-Sent Events — the frontend parses
 * the same `data: {...}` chunks Groq/OpenAI clients normally would, so
 * nothing here re-shapes the stream, it's a pure pass-through proxy. That's
 * the entire reason this service exists: to keep GROQ_API_KEY off the client
 * (a VITE_ env var ships straight into the browser bundle).
 */
export async function streamChat({ messages, documentContext }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("Missing GROQ_API_KEY (check ai-service/.env)");

  const systemContent = documentContext
    ? `${SYSTEM_PROMPT}\n\nHere is the user's current paper for context:\n${documentContext}`
    : SYSTEM_PROMPT;

  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      stream: true,
      messages: [{ role: "system", content: systemContent }, ...messages],
    }),
  });

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Groq API error ${response.status}: ${detail}`);
  }

  return Readable.fromWeb(response.body);
}
