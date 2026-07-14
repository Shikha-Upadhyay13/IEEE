import type { BodyNode } from "../../types/document";
import { useDocumentStore } from "../../store/documentStore";
import { RichParagraphEditor } from "./richtext/RichParagraphEditor";
import { btnGhost } from "../../lib/uiClasses";

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
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-1.5 text-xs text-gray-600">
        <input
          type="checkbox"
          checked={node.width === "double-column"}
          onChange={(e) => updateTableWidth(node.id, e.target.checked ? "double-column" : "single-column")}
          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        Span both columns
      </label>

      <table className="border-collapse">
        <tbody>
          {node.rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td key={c} className="border border-gray-200 p-0.5">
                  <input
                    value={cell}
                    onChange={(e) => setCell(r, c, e.target.value)}
                    className="w-[70px] text-xs px-1 py-0.5 border-none focus:outline-none focus:ring-1 focus:ring-indigo-400 rounded"
                  />
                </td>
              ))}
              <td className="pl-1">
                <button onClick={() => removeRow(r)} disabled={node.rows.length <= 1} className={btnGhost}>
                  − row
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex gap-2">
        <button onClick={addRow} className={btnGhost}>+ Row</button>
        <button onClick={addColumn} className={btnGhost}>+ Column</button>
        <button onClick={removeColumn} disabled={columnCount <= 1} className={btnGhost}>
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
