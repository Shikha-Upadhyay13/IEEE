import { useMemo } from "react";
import { resolveNumbering } from "./lib/numbering";
import { useDocumentStore } from "./store/documentStore";
import { useDebouncedValue } from "./lib/useDebouncedValue";
import { PagedPreview } from "./components/renderer/PagedPreview";
import { EditorPanel } from "./components/editor/EditorPanel";

function App() {
  const document = useDocumentStore((s) => s.document);
  // Pagination re-runs Paged.js's full chunker — too expensive to do on every
  // keystroke, so the preview follows edits after a short pause instead.
  const debouncedDocument = useDebouncedValue(document, 250);
  const resolvedDoc = useMemo(() => resolveNumbering(debouncedDocument), [debouncedDocument]);

  return (
    <div style={{ display: "flex" }}>
      <EditorPanel />
      <div style={{ background: "#525659", minHeight: "100vh", padding: "24px 0", flex: 1 }}>
        <PagedPreview document={resolvedDoc} />
      </div>
    </div>
  );
}

export default App;
