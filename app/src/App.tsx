import { useMemo } from "react";
import { resolveNumbering } from "./lib/numbering";
import { samplePaper } from "./data/samplePaper";
import { PagedPreview } from "./components/renderer/PagedPreview";

function App() {
  const resolvedDoc = useMemo(() => resolveNumbering(samplePaper), []);

  return (
    <div style={{ background: "#525659", minHeight: "100vh", padding: "24px 0" }}>
      <PagedPreview document={resolvedDoc} />
    </div>
  );
}

export default App;
