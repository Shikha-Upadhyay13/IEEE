import { useState } from "react";
import { useDocumentStore } from "../../store/documentStore";
import type { BodyNode } from "../../types/document";

type Paragraph = Extract<BodyNode, { type: "paragraph" }>;

function plainTextOf(node: Paragraph): string {
  return node.content.filter((n) => n.type === "text").map((n) => n.text).join("");
}

function hasNonTextContent(node: Paragraph): boolean {
  return node.content.some((n) => n.type !== "text");
}

function BlockEditorItem({ node, depth }: { node: BodyNode; depth: number }) {
  const updateParagraphText = useDocumentStore((s) => s.updateParagraphText);
  const updateSectionHeading = useDocumentStore((s) => s.updateSectionHeading);
  const removeBlock = useDocumentStore((s) => s.removeBlock);
  const indent = { marginLeft: depth * 16 };

  if (node.type === "section") {
    return (
      <div style={{ ...indent, border: "1px solid #ccc", padding: 8, marginBottom: 8 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={node.heading}
            onChange={(e) => updateSectionHeading(node.id, e.target.value)}
            style={{ flex: 1, fontWeight: "bold" }}
          />
          <button onClick={() => removeBlock(node.id)}>Delete</button>
        </div>
        {node.children.length === 0 ? (
          <p style={{ color: "#888", fontSize: 12 }}>(empty section)</p>
        ) : (
          node.children.map((child) => (
            <BlockEditorItem key={child.id} node={child} depth={depth + 1} />
          ))
        )}
      </div>
    );
  }

  if (node.type === "paragraph") {
    const warn = hasNonTextContent(node);
    return (
      <div style={{ ...indent, marginBottom: 8 }}>
        {warn && (
          <p style={{ color: "#a60", fontSize: 12, margin: "0 0 4px" }}>
            Contains citations/cross-references — editing this will remove them
            (rich-text editing arrives in a later milestone).
          </p>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <textarea
            value={plainTextOf(node)}
            onChange={(e) => updateParagraphText(node.id, e.target.value)}
            rows={3}
            style={{ flex: 1 }}
          />
          <button onClick={() => removeBlock(node.id)}>Delete</button>
        </div>
      </div>
    );
  }

  // figure / table / equation: not yet editable in this milestone (upload/
  // table-editor UI arrives later) — but can be removed.
  return (
    <div style={{ ...indent, display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
      <span style={{ fontSize: 12, color: "#555" }}>
        [{node.type}] {node.id}
      </span>
      <button onClick={() => removeBlock(node.id)}>Delete</button>
    </div>
  );
}

// Keeps its own draft text as the source of truth for what's displayed,
// separate from the store's normalized (split + trimmed + empties-dropped)
// keyword array — binding the input directly to the normalized array would
// snap back and eat a trailing ", " while the user is still typing the next
// keyword. The store is still updated on every keystroke; only the input's
// *display* value is decoupled from that normalization.
function KeywordsInput({
  keywords,
  onChange,
}: {
  keywords: string[];
  onChange: (commaSeparated: string) => void;
}) {
  const [draft, setDraft] = useState(keywords.join(", "));

  return (
    <>
      <label>Keywords (comma-separated)</label>
      <input
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          onChange(e.target.value);
        }}
        style={{ width: "100%", marginBottom: 12, boxSizing: "border-box" }}
      />
    </>
  );
}

export function EditorPanel() {
  const document = useDocumentStore((s) => s.document);
  const setTitle = useDocumentStore((s) => s.setTitle);
  const setAbstract = useDocumentStore((s) => s.setAbstract);
  const setKeywords = useDocumentStore((s) => s.setKeywords);
  const appendParagraph = useDocumentStore((s) => s.appendParagraph);
  const appendSection = useDocumentStore((s) => s.appendSection);

  const titleText = document.titleBlock.title
    .map((n) => (n.type === "text" ? n.text : ""))
    .join("");

  return (
    <div
      style={{
        width: 380,
        padding: 16,
        overflowY: "auto",
        height: "100vh",
        boxSizing: "border-box",
        fontFamily: "sans-serif",
        fontSize: 14,
      }}
    >
      <h2>Editor</h2>

      <label>Title</label>
      <textarea
        value={titleText}
        onChange={(e) => setTitle(e.target.value)}
        rows={2}
        style={{ width: "100%", marginBottom: 12, boxSizing: "border-box" }}
      />

      <label>Abstract</label>
      <textarea
        value={document.abstract.text}
        onChange={(e) => setAbstract(e.target.value)}
        rows={4}
        style={{ width: "100%", marginBottom: 12, boxSizing: "border-box" }}
      />

      <KeywordsInput keywords={document.keywords} onChange={setKeywords} />

      <h3>Body</h3>
      {document.body.map((node) => (
        <BlockEditorItem key={node.id} node={node} depth={0} />
      ))}

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={appendParagraph}>+ Paragraph</button>
        <button onClick={appendSection}>+ Section</button>
      </div>
    </div>
  );
}
