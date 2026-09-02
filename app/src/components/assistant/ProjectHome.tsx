import { useState } from "react";
import { relativeTime } from "../../lib/relativeTime";
import type { ProjectRow, ConversationRow } from "./ConversationSidebar";

// The empty state shown once a project is active instead of the generic
// "What are you writing today?" screen — a real landing page for the
// project (name, standing instructions, recent chats), the same role
// ChatGPT's own project page plays, rather than just a filtered chat list.
export function ProjectHome({
  project,
  conversations,
  onSelectConversation,
  onSetInstructions,
}: {
  project: ProjectRow;
  conversations: ConversationRow[];
  onSelectConversation: (id: string) => void;
  onSetInstructions: (instructions: string) => void;
}) {
  const [instructionsDraft, setInstructionsDraft] = useState(project.instructions ?? "");

  return (
    <div className="max-w-xl mx-auto animate-fade-in-up py-4 text-left">
      <div className="flex items-center gap-3 mb-6">
        <span
          className="flex-none w-12 h-12 rounded-xl flex items-center justify-center text-2xl bg-blue-100 dark:bg-blue-950/40"
          style={{ backgroundColor: project.color ? `${project.color}26` : undefined }}
        >
          📁
        </span>
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 truncate">{project.name}</h2>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            {conversations.length} {conversations.length === 1 ? "chat" : "chats"} in this project
          </p>
        </div>
      </div>

      <div className="mb-6">
        <label
          htmlFor="project-instructions"
          className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
        >
          Project instructions
        </label>
        <textarea
          id="project-instructions"
          value={instructionsDraft}
          onChange={(e) => setInstructionsDraft(e.target.value)}
          onBlur={() => {
            if (instructionsDraft !== (project.instructions ?? "")) onSetInstructions(instructionsDraft);
          }}
          rows={3}
          placeholder="Give Doc Buddy standing context for every chat in this project — tone, terminology, constraints…"
          className="w-full mt-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2 resize-none placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
        />
      </div>

      {conversations.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
            Recent chats
          </p>
          <div className="flex flex-col gap-1.5">
            {conversations.slice(0, 5).map((c) => (
              <button
                key={c.id}
                onClick={() => onSelectConversation(c.id)}
                className="text-left rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
              >
                <span className="block text-sm text-gray-800 dark:text-gray-200 truncate">{c.title}</span>
                <span className="block text-xs text-gray-400 dark:text-gray-500">{relativeTime(c.updated_at)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="text-sm text-gray-400 dark:text-gray-500 text-center">
        Type below to start a new chat in this project.
      </p>
    </div>
  );
}
