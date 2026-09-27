import { ArrowDown, ArrowUp, BookMarked, FileText, Layers, Palette, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { useDocumentStore } from "../../store/documentStore";
import { formatSectionNumber } from "../../lib/numbering";
import type { BodyNode } from "../../types/document";
import type { EditorView } from "./EditorPanel";

type OutlineSection = { id: string; label: string; number: string; depth: number };

function collectOutline(nodes: BodyNode[], depth = 0): OutlineSection[] {
  const out: OutlineSection[] = [];
  let index = 0;
  for (const node of nodes) {
    if (node.type !== "section") continue;
    index += 1;
    out.push({
      id: node.id,
      label: node.heading.trim() || "Untitled section",
      number: formatSectionNumber(index, depth),
      depth,
    });
    if (depth < 1) out.push(...collectOutline(node.children, depth + 1));
  }
  return out;
}

function isActive(view: EditorView, kind: EditorView["kind"], id?: string) {
  return view.kind === kind && (kind !== "section" || (view.kind === "section" && view.id === id));
}

function OutlineButton({
  active,
  onClick,
  icon,
  children,
  indent = 0,
}: {
  active: boolean;
  onClick: () => void;
  icon?: ReactNode;
  children: ReactNode;
  indent?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      style={indent ? { paddingLeft: 8 + indent * 12 } : undefined}
      className={`flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
        active ? "bg-accent-soft font-medium text-accent" : "text-ink hover:bg-canvas"
      }`}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </button>
  );
}

export function EditorOutline({ view, onChange }: { view: EditorView; onChange: (view: EditorView) => void }) {
  const body = useDocumentStore((s) => s.document.body);
  const referenceCount = useDocumentStore((s) => s.document.references.length);
  const reorderBlocks = useDocumentStore((s) => s.reorderBlocks);
  const appendSection = useDocumentStore((s) => s.appendSection);
  const sections = collectOutline(body);
  const topLevelSectionIds = body.filter((n) => n.type === "section").map((n) => n.id);

  function addSection() {
    appendSection();
    const next = useDocumentStore.getState().document.body;
    const created = next[next.length - 1];
    if (created) onChange({ kind: "section", id: created.id });
  }

  function moveSection(id: string, delta: -1 | 1) {
    const i = topLevelSectionIds.indexOf(id);
    const neighbour = topLevelSectionIds[i + delta];
    if (neighbour) reorderBlocks(null, id, neighbour);
  }

  return (
    <nav aria-label="Paper outline" className="flex h-full flex-col gap-4 overflow-y-auto px-2 py-4">
      <div className="flex flex-col gap-0.5">
        <OutlineButton
          active={isActive(view, "all")}
          onClick={() => onChange({ kind: "all" })}
          icon={<Layers size={15} className="flex-none text-muted" aria-hidden="true" />}
        >
          Whole paper
        </OutlineButton>
        <OutlineButton
          active={isActive(view, "details")}
          onClick={() => onChange({ kind: "details" })}
          icon={<FileText size={15} className="flex-none text-muted" aria-hidden="true" />}
        >
          Title, authors &amp; abstract
        </OutlineButton>
      </div>

      <div>
        <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Sections</p>
        {sections.length === 0 && <p className="px-2 text-xs text-muted">No sections yet.</p>}
        <ul className="flex flex-col gap-0.5">
          {sections.map((s) => {
            const topIndex = s.depth === 0 ? topLevelSectionIds.indexOf(s.id) : -1;
            return (
              <li key={s.id} className="group flex items-center">
                <OutlineButton
                  active={isActive(view, "section", s.id)}
                  onClick={() => onChange({ kind: "section", id: s.id })}
                  indent={s.depth}
                >
                  <span className="mr-1.5 font-mono text-xs text-muted">{s.number}.</span>
                  {s.label}
                </OutlineButton>
                {s.depth === 0 && (
                  <span className="flex flex-none opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    <button
                      type="button"
                      onClick={() => moveSection(s.id, -1)}
                      disabled={topIndex <= 0}
                      aria-label={`Move ${s.label} up`}
                      className="flex h-6 w-5 items-center justify-center rounded text-muted hover:text-ink disabled:opacity-30"
                    >
                      <ArrowUp size={12} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSection(s.id, 1)}
                      disabled={topIndex === topLevelSectionIds.length - 1}
                      aria-label={`Move ${s.label} down`}
                      className="flex h-6 w-5 items-center justify-center rounded text-muted hover:text-ink disabled:opacity-30"
                    >
                      <ArrowDown size={12} aria-hidden="true" />
                    </button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={addSection}
          className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted transition-colors hover:bg-canvas hover:text-ink"
        >
          <Plus size={15} className="flex-none" aria-hidden="true" />
          Add section
        </button>
      </div>

      <div className="flex flex-col gap-0.5">
        <OutlineButton
          active={isActive(view, "references")}
          onClick={() => onChange({ kind: "references" })}
          icon={<BookMarked size={15} className="flex-none text-muted" aria-hidden="true" />}
        >
          References {referenceCount > 0 && <span className="text-xs text-muted">({referenceCount})</span>}
        </OutlineButton>
        <OutlineButton
          active={isActive(view, "appearance")}
          onClick={() => onChange({ kind: "appearance" })}
          icon={<Palette size={15} className="flex-none text-muted" aria-hidden="true" />}
        >
          Appearance
        </OutlineButton>
      </div>
    </nav>
  );
}
