import { Routes, Route } from "react-router-dom";
import { LoginPage } from "./routes/LoginPage";
import { Dashboard } from "./routes/Dashboard";
import { EditorPage } from "./routes/EditorPage";
import { PrintView } from "./routes/PrintView";
import { RequireAuth } from "./components/RequireAuth";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="/editor/:documentId" element={<RequireAuth><EditorPage /></RequireAuth>} />
      {/* Not behind RequireAuth: the headless PDF export path has no user
          session at all (see PrintView's own token-vs-session handling). */}
      <Route path="/print/:documentId" element={<PrintView />} />
    </Routes>
  );
}

export default App;
