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
    <div className="flex-none px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60">
      <div className="flex items-center gap-3">
        <span
          className="flex-none w-9 h-9 rounded-lg flex items-center justify-center text-base bg-blue-100 dark:bg-blue-950/40"
          style={project.color ? { backgroundColor: `${project.color}26` } : undefined}
        >
          📁
        </span>
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
            className="flex-1 min-w-0 text-base font-semibold text-gray-900 dark:text-gray-100 bg-transparent border-b border-gray-400 dark:border-gray-500 focus:outline-none"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            title="Click to rename"
            className="flex-1 min-w-0 text-left text-base font-semibold text-gray-900 dark:text-gray-100 hover:underline truncate"
          >
            {project.name}
          </button>
        )}
        <span className="flex-none text-xs text-gray-400 dark:text-gray-500">
          {conversationCount} {conversationCount === 1 ? "chat" : "chats"}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-3 pl-12">
        <label htmlFor="project-default-paper" className="text-xs text-gray-500 dark:text-gray-400 flex-none">
          Default paper
        </label>
        <select
          id="project-default-paper"
          value={project.default_document_id ?? ""}
          onChange={(e) => onSetDefaultPaper(e.target.value || null)}
          title="Every new chat in this project attaches this paper automatically"
          className="text-sm rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 px-2.5 py-1.5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-400 max-w-52"
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
          className="ml-auto text-xs text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
        >
          Delete project
        </button>
      </div>
    </div>
  );
}
