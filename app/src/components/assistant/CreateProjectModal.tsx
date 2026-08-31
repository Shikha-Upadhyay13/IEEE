import { useState, type FormEvent } from "react";
import { btnPrimary, btnSecondary, inputBase, labelBase } from "../../lib/uiClasses";

// Same curated, not-purple palette used by the paper editor's own Appearance
// panel — a project's color is a per-user organizational choice, same idea
// as ChatGPT's project icon-color picker.
const COLOR_SWATCHES = ["#64748b", "#2563eb", "#0ea5e9", "#14b8a6", "#10b981", "#f59e0b", "#f97316", "#f43f5e"];

// A real "name it, pick a color, Create" dialog — same shape as ChatGPT's
// own "New project" flow — rather than a single text input that silently
// closes on blur with no confirmation the project was actually created.
export function CreateProjectModal({
  onCreate,
  onClose,
}: {
  onCreate: (name: string, color: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLOR_SWATCHES[0]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate(trimmed, color);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-sm w-full p-5 animate-fade-in-up"
      >
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">New project</h3>

        <label htmlFor="new-project-name" className={labelBase}>
          Name
        </label>
        <input
          id="new-project-name"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Capstone paper"
          className={`${inputBase} mb-4`}
        />

        <p className={labelBase}>Color</p>
        <div className="flex flex-wrap gap-2 mb-5">
          {COLOR_SWATCHES.map((swatch) => (
            <button
              key={swatch}
              type="button"
              onClick={() => setColor(swatch)}
              aria-label={`Color ${swatch}`}
              aria-pressed={color === swatch}
              className={`w-7 h-7 rounded-full border-2 transition-all ${
                color === swatch ? "border-gray-900 dark:border-gray-100 scale-110" : "border-transparent hover:scale-105"
              }`}
              style={{ backgroundColor: swatch }}
            />
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnSecondary}>
            Cancel
          </button>
          <button type="submit" disabled={!name.trim()} className={btnPrimary}>
            Create project
          </button>
        </div>
      </form>
    </div>
  );
}
