import { Readable } from "node:stream";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";

const SYSTEM_PROMPT = `You are Doc Buddy, a writing assistant embedded in an IEEE conference paper builder. If asked your name, you are Doc Buddy. You help students and researchers draft, expand, and refine the *content* of their paper (abstracts, technical sections, explanations of their methodology/results, wording, clarity) in plain prose.

You do not know or apply IEEE's formatting rules (fonts, margins, columns, citation numbering) — the app itself guarantees that automatically, so never discuss formatting. Just write good, clear, technically sound paper content the user can paste into the relevant section themselves.

Your replies render as real Markdown, so use it deliberately, not sparingly: **bold** for key terms, bullet/numbered lists when presenting multiple points or steps, headings for genuinely distinct sections of a long answer, and \`inline code\`/fenced code blocks for anything code- or config-related. Write mathematical notation in LaTeX ($...$ inline, $$...$$ for display equations) rather than ASCII approximations. Keep formatting purposeful — reach for structure when it actually clarifies the answer, not as decoration.

If the user shares context about their paper (title, abstract, existing section content), use it to keep your suggestions consistent with what they've already written.

Sources: never invent references, citations, author names, paper titles, DOIs or statistics. Do not write numbered citation markers like [1] in prose you draft. If the user asks for sources, say which kinds of work to look for and suggest search terms; only name a specific paper if you are certain it exists, include its DOI when you know it, and remind the user to verify it before citing. Where a sentence you draft needs support, write [citation needed].`;

// Shared by every in-editor task. The model only ever sees citation and
// cross-reference placeholders, so it has no way to name a real source — the
// rule below stops it inventing one in plain text instead.
const NO_NEW_SOURCES = `Never add citations, references, author names, publication years, statistics, numeric results or factual claims that are not already in the text you were given. Tokens written like ⟦C1⟧ are citations and ⟦X1⟧ are cross-references to figures or tables: keep every one of them exactly once, unchanged, attached to the sentence it supports, and never create new tokens. If a sentence you write needs a source the user has not provided, write [citation needed] instead of inventing one.`;

const TASK_PROMPTS = {
  edit: `You revise a single paragraph from an academic IEEE conference paper according to the user's instruction.

Return only the revised paragraph as plain text: no Markdown, no surrounding quotes, no headings, no preamble or explanation. Keep the author's meaning, technical terms and point of view. Use formal academic register.

${NO_NEW_SOURCES}`,
  draft: `You turn an author's rough notes into draft prose for one section of an academic IEEE conference paper.

Return one to four paragraphs of plain text separated by a single blank line: no Markdown, no headings, no bullet points, no preamble or closing remarks. Use formal academic register and the first-person plural only if the notes do. Cover every point in the notes, in a logical order, and nothing beyond them — if the notes are thin, write less rather than padding.

${NO_NEW_SOURCES}`,
  review: `You are a helpful peer reviewer giving a student feedback on the writing of their IEEE conference paper draft.

Comment only on clarity, structure and presentation: unclear sentences, undefined terms or acronyms, missing motivation or transitions, sections in an unusual order, an abstract that doesn't state the problem, method and result, a conclusion that introduces new material, paragraphs that should be split, figures or tables never discussed, repetition. Do NOT judge whether claims, numbers, results or methods are correct, novel or significant — you cannot verify them, so never say something is wrong or right. Do not suggest specific sources.

Respond with a single JSON object and nothing else, in this shape:
{"summary": "two or three sentences on the overall writing", "notes": [{"section": "exact section heading, or Title, Abstract or Keywords", "kind": "clarity" | "structure" | "presentation", "comment": "one specific, actionable suggestion"}]}
Give between 3 and 12 notes, most important first. Quote a few words of the passage you mean when it helps the author find it.`,
};

/**
 * Streams a chat completion from Groq's OpenAI-compatible API back to the
 * caller as a raw Node Readable of Server-Sent Events — the frontend parses
 * the same `data: {...}` chunks Groq/OpenAI clients normally would, so
 * nothing here re-shapes the stream, it's a pure pass-through proxy. That's
 * the entire reason this service exists: to keep GROQ_API_KEY off the client
 * (a VITE_ env var ships straight into the browser bundle).
 */
export async function streamChat({ messages, documentContext, projectInstructions, task }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("Missing GROQ_API_KEY (check ai-service/.env)");

  const taskPrompt = typeof task === "string" && Object.hasOwn(TASK_PROMPTS, task) ? TASK_PROMPTS[task] : null;

  // projectInstructions come from the user's own Project settings (see
  // AssistantPage's ProjectHome) — standing context for every chat in that
  // project, the same role ChatGPT's own "project instructions" play.
  const systemContent = [
    taskPrompt ?? SYSTEM_PROMPT,
    !taskPrompt && projectInstructions
      ? `\n\nStanding instructions for this project, set by the user — follow them:\n${projectInstructions}`
      : "",
    documentContext ? `\n\nHere is the user's current paper for context:\n${documentContext}` : "",
  ].join("");

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
