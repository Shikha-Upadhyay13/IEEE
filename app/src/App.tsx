import { Routes, Route, Navigate } from "react-router-dom";
import { LandingPage } from "./routes/LandingPage";
import { LoginPage } from "./routes/LoginPage";
import { Dashboard } from "./routes/Dashboard";
import { EditorPage } from "./routes/EditorPage";
import { PrintView } from "./routes/PrintView";
import { AssistantPage } from "./routes/AssistantPage";
import { ImagesPage } from "./routes/ImagesPage";
import { ProfilePage } from "./routes/ProfilePage";
import { SettingsPage } from "./routes/SettingsPage";
import { RequireAuth } from "./components/RequireAuth";
import { ChatLauncher } from "./components/ChatLauncher";
import { useAuth } from "./lib/useAuth";

// Signed-in visitors who land on the public "/" marketing page should go
// straight to their papers instead of seeing the pitch again.
function LandingOrDashboard() {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (session) return <Navigate to="/dashboard" replace />;
  return <LandingPage />;
}

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<LandingOrDashboard />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/editor/:documentId" element={<RequireAuth><EditorPage /></RequireAuth>} />
        <Route path="/assistant" element={<RequireAuth><AssistantPage /></RequireAuth>} />
        <Route path="/images" element={<RequireAuth><ImagesPage /></RequireAuth>} />
        <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
        <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
        {/* Not behind RequireAuth: the headless PDF export path has no user
            session at all (see PrintView's own token-vs-session handling). */}
        <Route path="/print/:documentId" element={<PrintView />} />
      </Routes>
      <ChatLauncher />
    </>
  );
}

export default App;
