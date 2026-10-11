import { useState } from "react";
import { useDocumentStore } from "../../store/documentStore";
import { AI_USES, aiDisclosureText, type AiUseId } from "../../lib/aiDisclosure";
import { btnSecondary, inputBase, labelBase } from "../../lib/uiClasses";

/** Builds the AI-use statement IEEE requires in the Acknowledgment section. */
export function AiDisclosureFields() {
  const addAcknowledgmentParagraph = useDocumentStore((s) => s.addAcknowledgmentParagraph);
  const [open, setOpen] = useState(false);
  const [tool, setTool] = useState("");
  const [uses, setUses] = useState<AiUseId[]>([]);
  const [sections, setSections] = useState("");
  const [added, setAdded] = useState(false);

  const text = aiDisclosureText({ tool, uses, sections });

  function toggle(id: AiUseId, on: boolean) {
    setAdded(false);
    setUses((current) => (on ? [...current, id] : current.filter((u) => u !== id)));
  }

  function add() {
    addAcknowledgmentParagraph(text);
    setAdded(true);
  }

  return (
    <div className="mt-6 pt-5 border-t border-line">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">AI-use disclosure</h3>
        <button type="button" onClick={() => setOpen((o) => !o)} className="text-xs font-medium text-accent hover:underline">
          {open ? "Hide" : "Write one"}
        </button>
      </div>
      <p className="text-xs text-muted mt-1">
        IEEE asks authors to name any AI system used, what it did and where, in the Acknowledgment section.
      </p>

      {open && (
        <div className="mt-3">
          <label htmlFor="ai-tool" className={labelBase}>
            AI system
          </label>
          <input
            id="ai-tool"
            value={tool}
            placeholder="ChatGPT (OpenAI)"
            onChange={(e) => {
              setAdded(false);
              setTool(e.target.value);
            }}
            className={inputBase}
          />

          <fieldset className="mt-3">
            <legend className={labelBase}>Used for</legend>
            <div className="flex flex-col gap-1.5">
              {AI_USES.map((u) => (
                <label key={u.id} className="flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" checked={uses.includes(u.id)} onChange={(e) => toggle(u.id, e.target.checked)} />
                  {u.label}
                </label>
              ))}
            </div>
          </fieldset>

          <label htmlFor="ai-sections" className={`${labelBase} mt-3`}>
            Where in the paper
          </label>
          <input
            id="ai-sections"
            value={sections}
            placeholder="Sections II and IV"
            onChange={(e) => {
              setAdded(false);
              setSections(e.target.value);
            }}
            className={inputBase}
          />

          <p className="mt-3 rounded-md border border-line bg-canvas p-2.5 text-xs text-ink leading-relaxed">{text}</p>
          <div className="mt-2 flex items-center gap-3">
            <button type="button" onClick={add} disabled={added} className={`${btnSecondary} text-xs py-1.5 px-3`}>
              Add to Acknowledgment
            </button>
            {added && (
              <span role="status" className="text-xs text-emerald-600 dark:text-emerald-400">
                Added — edit it in the Acknowledgment section.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
