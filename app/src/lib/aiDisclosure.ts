export const AI_USES = [
  { id: "editing", label: "Editing grammar and clarity", phrase: "to edit the text for grammar and clarity" },
  { id: "drafting", label: "Drafting text", phrase: "to draft parts of the text" },
  { id: "literature", label: "Searching the literature", phrase: "to help search the literature" },
  { id: "code", label: "Writing code", phrase: "to help write code" },
  { id: "analysis", label: "Analysing data", phrase: "to assist with data analysis" },
  { id: "figures", label: "Creating figures or images", phrase: "to create figures" },
] as const;

export type AiUseId = (typeof AI_USES)[number]["id"];

export type AiDisclosure = { tool: string; uses: AiUseId[]; sections: string };

function joinPhrases(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

/**
 * The acknowledgment sentence IEEE's AI policy asks for: which system, what it
 * was used for, and where in the paper.
 */
export function aiDisclosureText({ tool, uses, sections }: AiDisclosure): string {
  const phrases = AI_USES.filter((u) => uses.includes(u.id)).map((u) => u.phrase);
  const where = sections.trim() ? ` in ${sections.trim().replace(/\.$/, "")}` : "";
  const name = tool.trim() || "a generative AI tool";
  return (
    `The authors used ${name} ${joinPhrases(phrases) || "in preparing this article"}${where}. ` +
    "All AI-generated content was reviewed and edited by the authors, who take full responsibility for the content of this article."
  );
}
