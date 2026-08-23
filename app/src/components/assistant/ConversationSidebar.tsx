import { useState } from "react";

export type ConversationRow = { id: string; title: string; project_id: string | null; updated_at: string };
export type ProjectRow = { id: string; name: string };

// A left rail styled like ChatGPT's — dark, icon-first, with the running
// conversation list as the main content — is the most recognizable "this is
// a serious AI product" visual cue available without a custom icon set.
export function ConversationSidebar({
  conversations,
  projects,
  activeConversationId,
  activeProjectId,
  userEmail,
  onNewChat,
  onSelectConversation,
  onRenameConversation,
  onDeleteConversation,
  onSelectProject,
  onCreateProject,
  onDeleteProject,
  onSignOut,
}: {
  conversations: ConversationRow[];
  projects: ProjectRow[];
  activeConversationId: string | null;
  activeProjectId: string | null;
  userEmail: string | null;
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
  onRenameConversation: (id: string, title: string) => void;
  onDeleteConversation: (id: string) => void;
  onSelectProject: (id: string | null) => void;
  onCreateProject: (name: string) => void;
  onDeleteProject: (id: string) => void;
  onSignOut: () => void;
}) {
  const [creatingProject, setCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");

  const visibleConversations = activeProjectId
    ? conversations.filter((c) => c.project_id === activeProjectId)
    : conversations;

  function commitNewProject() {
    const trimmed = newProjectName.trim();
    if (trimmed) onCreateProject(trimmed);
    setNewProjectName("");
    setCreatingProject(false);
  }

  function startRename(c: ConversationRow) {
    setEditingId(c.id);
    setDraftTitle(c.title);
  }

  function commitRename(id: string) {
    const trimmed = draftTitle.trim();
    setEditingId(null);
    if (trimmed) onRenameConversation(id, trimmed);
  }

  return (
    <div className="w-64 flex-none h-full flex flex-col bg-gray-900 text-gray-300">
      <div className="p-3">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-2 rounded-lg border border-gray-700 hover:bg-gray-800 px-3 py-2 text-sm text-white transition-colors"
        >
          <span className="text-base leading-none">＋</span> New chat
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3">
        <div className="mb-4">
          <div className="flex items-center justify-between px-1 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Projects</span>
            <button
              onClick={() => setCreatingProject(true)}
              aria-label="New project"
              className="text-gray-500 hover:text-white transition-colors text-sm leading-none"
            >
              ＋
            </button>
          </div>

          <button
            onClick={() => onSelectProject(null)}
            className={`w-full text-left text-sm rounded-md px-2 py-1.5 mb-0.5 transition-colors ${
              activeProjectId === null ? "bg-gray-800 text-white" : "hover:bg-gray-800/60"
            }`}
          >
            All chats
          </button>

          {projects.map((p) => (
            <div
              key={p.id}
              className={`group flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm cursor-pointer transition-colors ${
                activeProjectId === p.id ? "bg-gray-800 text-white" : "hover:bg-gray-800/60"
              }`}
              onClick={() => onSelectProject(p.id)}
            >
              <span className="text-xs">📁</span>
              <span className="flex-1 truncate">{p.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteProject(p.id);
                }}
                aria-label={`Delete project ${p.name}`}
                className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all text-xs"
              >
                ✕
              </button>
            </div>
          ))}

          {creatingProject && (
            <input
              autoFocus
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onBlur={commitNewProject}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") {
                  setNewProjectName("");
                  setCreatingProject(false);
                }
              }}
              placeholder="Project name…"
              className="w-full mt-0.5 text-sm bg-gray-800 border border-gray-600 rounded-md px-2 py-1.5 text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          )}
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 px-1 mb-1.5">Chats</p>
          {visibleConversations.length === 0 && (
            <p className="text-xs text-gray-600 px-2 py-1">No conversations yet.</p>
          )}
          {visibleConversations.map((c) => (
            <div
              key={c.id}
              className={`group flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm cursor-pointer transition-colors ${
                activeConversationId === c.id ? "bg-gray-800 text-white" : "hover:bg-gray-800/60"
              }`}
              onClick={() => onSelectConversation(c.id)}
            >
              {editingId === c.id ? (
                <input
                  autoFocus
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  onBlur={() => commitRename(c.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 bg-gray-700 rounded px-1 py-0.5 text-white text-sm focus:outline-none"
                />
              ) : (
                <span
                  className="flex-1 truncate"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    startRename(c);
                  }}
                  title={`${c.title} (double-click to rename)`}
                >
                  {c.title}
                </span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteConversation(c.id);
                }}
                aria-label={`Delete conversation ${c.title}`}
                className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all text-xs"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-none border-t border-gray-800 p-3 flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-indigo-500 text-white flex items-center justify-center text-xs font-semibold flex-none">
          {userEmail?.[0]?.toUpperCase() ?? "?"}
        </div>
        <span className="flex-1 truncate text-xs text-gray-400">{userEmail}</span>
        <button
          onClick={onSignOut}
          title="Sign out"
          aria-label="Sign out"
          className="text-gray-500 hover:text-white transition-colors text-xs"
        >
          ⏻
        </button>
      </div>
    </div>
  );
}
