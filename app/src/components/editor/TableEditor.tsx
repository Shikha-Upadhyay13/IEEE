import type { BodyNode } from "../../types/document";
import { useDocumentStore } from "../../store/documentStore";
import { RichParagraphEditor } from "./richtext/RichParagraphEditor";

type Table = Extract<BodyNode, { type: "table" }>;

export function TableEditor({ node }: { node: Table }) {
  const updateTableCaption = useDocumentStore((s) => s.updateTableCaption);
  const updateTableRows = useDocumentStore((s) => s.updateTableRows);
  const updateTableWidth = useDocumentStore((s) => s.updateTableWidth);

  const columnCount = node.rows[0]?.length ?? 0;

  function setCell(rowIndex: number, colIndex: number, value: string) {
    const rows = node.rows.map((row, r) => (r === rowIndex ? row.map((cell, c) => (c === colIndex ? value : cell)) : row));
    updateTableRows(node.id, rows);
  }

  function addRow() {
    updateTableRows(node.id, [...node.rows, Array(columnCount).fill("")]);
  }

  function removeRow(rowIndex: number) {
    updateTableRows(node.id, node.rows.filter((_, r) => r !== rowIndex));
  }

  function addColumn() {
    updateTableRows(node.id, node.rows.map((row) => [...row, ""]));
  }

  function removeColumn() {
    if (columnCount <= 1) return;
    updateTableRows(node.id, node.rows.map((row) => row.slice(0, -1)));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 12 }}>
        <input
          type="checkbox"
          checked={node.width === "double-column"}
          onChange={(e) => updateTableWidth(node.id, e.target.checked ? "double-column" : "single-column")}
        />
        Span both columns
      </label>

      <table style={{ borderCollapse: "collapse" }}>
        <tbody>
          {node.rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td key={c} style={{ border: "1px solid #ccc", padding: 2 }}>
                  <input
                    value={cell}
                    onChange={(e) => setCell(r, c, e.target.value)}
                    style={{ width: 70, fontSize: 12, border: "none" }}
                  />
                </td>
              ))}
              <td>
                <button onClick={() => removeRow(r)} disabled={node.rows.length <= 1}>
                  − row
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={addRow}>+ Row</button>
        <button onClick={addColumn}>+ Column</button>
        <button onClick={removeColumn} disabled={columnCount <= 1}>
          − Column
        </button>
      </div>

      <RichParagraphEditor
        content={node.caption}
        onChange={(caption) => updateTableCaption(node.id, caption)}
      />
    </div>
  );
}
