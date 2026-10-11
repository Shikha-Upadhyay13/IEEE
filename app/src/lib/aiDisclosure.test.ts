import { describe, expect, it } from "vitest";
import { aiDisclosureText } from "./aiDisclosure";

describe("aiDisclosureText", () => {
  it("names the tool, the uses in a fixed order and the sections", () => {
    expect(aiDisclosureText({ tool: "ChatGPT (OpenAI)", uses: ["figures", "editing"], sections: "Sections II and IV." })).toBe(
      "The authors used ChatGPT (OpenAI) to edit the text for grammar and clarity and to create figures in Sections II and IV. " +
        "All AI-generated content was reviewed and edited by the authors, who take full responsibility for the content of this article."
    );
  });

  it("falls back to neutral wording when details are missing", () => {
    expect(aiDisclosureText({ tool: "", uses: [], sections: "" })).toMatch(
      /^The authors used a generative AI tool in preparing this article\. /
    );
  });
});
