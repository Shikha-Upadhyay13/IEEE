import { useState } from "react";
import { Folder } from "lucide-react";
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
          className="flex-none w-12 h-12 rounded-xl flex items-center justify-center bg-accent-soft text-accent"
          style={project.color ? { backgroundColor: `${project.color}26`, color: project.color } : undefined}
        >
          <Folder size={22} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-ink truncate">{project.name}</h2>
          <p className="text-sm text-muted">
            {conversations.length} {conversations.length === 1 ? "chat" : "chats"} in this project
          </p>
        </div>
      </div>

      <div className="mb-6">
        <label
          htmlFor="project-instructions"
          className="text-xs font-semibold uppercase tracking-wide text-muted"
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
          className="w-full mt-1.5 text-sm rounded-lg border border-line bg-surface text-ink px-3 py-2 resize-none placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {conversations.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
            Recent chats
          </p>
          <div className="flex flex-col gap-1.5">
            {conversations.slice(0, 5).map((c) => (
              <button
                key={c.id}
                onClick={() => onSelectConversation(c.id)}
                className="text-left rounded-lg border border-line px-3 py-2 hover:border-accent transition-colors"
              >
                <span className="block text-sm text-ink truncate">{c.title}</span>
                <span className="block text-xs text-muted">{relativeTime(c.updated_at)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="text-sm text-muted text-center">
        Type below to start a new chat in this project.
      </p>
    </div>
  );
}
