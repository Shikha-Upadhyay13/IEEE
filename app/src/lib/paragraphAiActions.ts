export type ParagraphAiAction = "formal" | "shorten" | "expand" | "grammar";

export const PARAGRAPH_AI_ACTIONS: { id: ParagraphAiAction; label: string; description: string; instruction: string }[] = [
  {
    id: "formal",
    label: "Rewrite formally",
    description: "Academic register, same meaning",
    instruction: "Rewrite this paragraph in a clearer, more formal academic register.",
  },
  {
    id: "shorten",
    label: "Shorten",
    description: "About a third shorter",
    instruction: "Shorten this paragraph by about a third without losing any technical content.",
  },
  {
    id: "expand",
    label: "Expand",
    description: "Explain the existing points more fully",
    instruction:
      "Expand this paragraph by explaining the ideas already in it more fully — reasoning, definitions and connections between sentences. Do not add new facts, results or claims.",
  },
  {
    id: "grammar",
    label: "Fix grammar",
    description: "Spelling, grammar and punctuation only",
    instruction: "Fix grammar, spelling and punctuation only. Change as few words as possible.",
  },
];
