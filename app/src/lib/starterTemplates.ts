import type { BodyNode } from "../types/document";
import { generateId } from "./id";

export type StarterTemplateId = "conference" | "project-report" | "survey" | "experimental";

type SectionSpec = { heading: string; hint: string; children?: SectionSpec[] };

export type StarterTemplate = {
  id: StarterTemplateId;
  name: string;
  description: string;
  sections: SectionSpec[];
};

// Placeholder paragraphs use the same "do Y" instructional voice as the rest
// of the editor's placeholders so they read as obviously-replace-this.
export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: "conference",
    name: "Research paper",
    description: "Introduction, Methodology, Results, Conclusion — the standard conference shape.",
    sections: [
      { heading: "Introduction", hint: "Introduce the problem, briefly cover related work, and state this paper's contribution." },
      { heading: "Methodology", hint: "Describe your approach, system design, or experimental setup." },
      { heading: "Results", hint: "Present your results, findings, or evaluation." },
      { heading: "Conclusion", hint: "Summarize your contribution and discuss possible future work." },
    ],
  },
  {
    id: "project-report",
    name: "Project report",
    description: "For final-year and course projects: objectives, literature review, system design, results.",
    sections: [
      {
        heading: "Introduction",
        hint: "State the problem your project addresses, why it matters, and the objectives you set out to meet.",
      },
      {
        heading: "Literature Review",
        hint: "Summarize existing systems or research related to your project and the gap your work fills.",
      },
      {
        heading: "System Design",
        hint: "Give an overview of the architecture before going into the details below.",
        children: [
          { heading: "Architecture", hint: "Describe the main components and how they interact. A block diagram works well here." },
          { heading: "Implementation", hint: "Describe the tools, languages, and frameworks used and any notable implementation choices." },
        ],
      },
      {
        heading: "Results and Discussion",
        hint: "Show what the finished system does, how you tested it, and what the results mean.",
      },
      {
        heading: "Conclusion and Future Work",
        hint: "Summarize what the project achieved against its objectives and what could be improved next.",
      },
    ],
  },
  {
    id: "survey",
    name: "Survey / review paper",
    description: "Background, taxonomy, comparison of existing work, open challenges.",
    sections: [
      {
        heading: "Introduction",
        hint: "Introduce the field, explain why a survey is useful now, and outline the scope and structure of this review.",
      },
      { heading: "Background", hint: "Define the key concepts and terminology a reader needs for the rest of the paper." },
      {
        heading: "Taxonomy",
        hint: "Explain how you group existing approaches, and the criteria that separate one group from another.",
      },
      {
        heading: "Review of Existing Approaches",
        hint: "Discuss representative work in each category, citing the original papers.",
      },
      {
        heading: "Comparative Analysis",
        hint: "Compare the approaches side by side — a table of methods against criteria is a common way to do this.",
      },
      {
        heading: "Open Challenges and Future Directions",
        hint: "Identify unsolved problems and promising directions for future research.",
      },
      { heading: "Conclusion", hint: "Summarize the main takeaways of the survey." },
    ],
  },
  {
    id: "experimental",
    name: "Experimental paper",
    description: "Proposed method, experimental setup, datasets and metrics, results, discussion.",
    sections: [
      { heading: "Introduction", hint: "Introduce the problem, the limitation of current methods, and your contributions." },
      { heading: "Related Work", hint: "Position your work against prior methods, citing the most relevant ones." },
      { heading: "Proposed Method", hint: "Describe your method in enough detail for someone to reproduce it." },
      {
        heading: "Experimental Setup",
        hint: "Describe how the experiments were run.",
        children: [
          { heading: "Datasets", hint: "Describe each dataset: source, size, and any preprocessing." },
          { heading: "Evaluation Metrics", hint: "Define the metrics you report and why they suit this problem." },
        ],
      },
      { heading: "Results", hint: "Report your results against baselines. Tables and figures should be referred to in the text." },
      { heading: "Discussion", hint: "Interpret the results, including limitations and cases where the method does not work well." },
      { heading: "Conclusion", hint: "Summarize the contribution and the most important result." },
    ],
  },
];

function buildSection(spec: SectionSpec, level: number): BodyNode {
  return {
    type: "section",
    id: generateId("sec"),
    heading: spec.heading,
    level,
    children: [
      { type: "paragraph", id: generateId("p"), content: [{ type: "text", text: spec.hint }] },
      ...(spec.children ?? []).map((child) => buildSection(child, level + 1)),
    ],
  };
}

export function buildTemplateBody(id: StarterTemplateId): BodyNode[] {
  const template = STARTER_TEMPLATES.find((t) => t.id === id) ?? STARTER_TEMPLATES[0];
  return template.sections.map((s) => buildSection(s, 1));
}
