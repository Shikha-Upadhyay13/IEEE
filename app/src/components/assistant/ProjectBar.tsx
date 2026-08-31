import { useState } from "react";
import type { ProjectRow } from "./ConversationSidebar";

type DocumentOption = { id: string; title: string | null };

// A proper, visible "you're working inside a project" surface — the
// sidebar's project list is just a filter/switcher; this is where a project
// actually becomes a section of its own, with a name you can edit and a
// default paper every new chat here will pick up automatically. That's the
// whole point of separate projects: Project A always means Paper A.
export function ProjectBar({
  project,
  conversationCount,
  documentOptions,
  onRename,
  onSetDefaultPaper,
  onDelete,
}: {
  project: ProjectRow;
  conversationCount: number;
  documentOptions: DocumentOption[];
  onRename: (name: string) => void;
  onSetDefaultPaper: (documentId: string | null) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(project.name);

  function commitRename() {
    setEditing(false);
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== project.name) onRename(trimmed);
    else setDraftName(project.name);
  }

  return (
    <div className="flex-none flex flex-wrap items-center gap-x-3 gap-y-2 px-6 py-2.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/40">
      <span className="text-sm flex-none">📁</span>
      {editing ? (
        <input
          autoFocus
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setDraftName(project.name);
              setEditing(false);
            }
          }}
          className="text-sm font-semibold text-gray-900 dark:text-gray-100 bg-transparent border-b border-gray-400 dark:border-gray-500 focus:outline-none"
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          title="Click to rename"
          className="text-sm font-semibold text-gray-900 dark:text-gray-100 hover:underline"
        >
          {project.name}
        </button>
      )}
      <span className="text-xs text-gray-400 dark:text-gray-500">
        {conversationCount} {conversationCount === 1 ? "chat" : "chats"}
      </span>

      <div className="ml-auto flex items-center gap-2">
        <label htmlFor="project-default-paper" className="text-xs text-gray-400 dark:text-gray-500">
          Default paper
        </label>
        <select
          id="project-default-paper"
          value={project.default_document_id ?? ""}
          onChange={(e) => onSetDefaultPaper(e.target.value || null)}
          title="Every new chat in this project attaches this paper automatically"
          className="text-xs rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 px-2 py-1 cursor-pointer focus:outline-none focus:ring-1 focus:ring-gray-400 max-w-40"
        >
          <option value="">None</option>
          {documentOptions.map((doc) => (
            <option key={doc.id} value={doc.id}>
              {doc.title || "Untitled paper"}
            </option>
          ))}
        </select>
        <button
          onClick={onDelete}
          className="text-xs text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
        >
          Delete project
        </button>
      </div>
    </div>
  );
}
