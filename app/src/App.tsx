import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { LandingPage } from "./routes/LandingPage";
import { LoginPage } from "./routes/LoginPage";
import { ResetPasswordPage } from "./routes/ResetPasswordPage";
import { RequireAuth } from "./components/RequireAuth";
import { ChatLauncher } from "./components/ChatLauncher";
import { CommandPalette } from "./components/CommandPalette";
import { LoadingScreen } from "./components/LoadingScreen";
import { useAuth } from "./lib/useAuth";

// Everything behind a sign-in wall (plus the headless print route) is
// lazy-loaded rather than bundled into the initial chunk — a first-time
// visitor hitting the public landing page shouldn't have to download the
// editor's TipTap/dnd-kit/MathLive stack or the assistant's
// react-markdown/KaTeX stack before the pitch page even paints. Landing,
// login, and reset-password stay eager since they're the pages a fresh
// visitor (no auth, nothing to lazy-load yet) actually lands on first.
const Dashboard = lazy(() => import("./routes/Dashboard").then((m) => ({ default: m.Dashboard })));
const EditorPage = lazy(() => import("./routes/EditorPage").then((m) => ({ default: m.EditorPage })));
const PrintView = lazy(() => import("./routes/PrintView").then((m) => ({ default: m.PrintView })));
const AssistantPage = lazy(() => import("./routes/AssistantPage").then((m) => ({ default: m.AssistantPage })));
const ProfilePage = lazy(() => import("./routes/ProfilePage").then((m) => ({ default: m.ProfilePage })));
const SettingsPage = lazy(() => import("./routes/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const DownloadsPage = lazy(() => import("./routes/DownloadsPage").then((m) => ({ default: m.DownloadsPage })));

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
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/" element={<LandingOrDashboard />} />
          <Route path="/login" element={<LoginPage />} />
          {/* Reached via the emailed reset link, which carries its own recovery
              token — not wrapped in RequireAuth so this page can manage that
              transitional auth state itself (see its own comment). */}
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/editor/:documentId" element={<RequireAuth><EditorPage /></RequireAuth>} />
          <Route path="/assistant" element={<RequireAuth><AssistantPage /></RequireAuth>} />
          <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
          <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
          <Route path="/downloads" element={<RequireAuth><DownloadsPage /></RequireAuth>} />
          {/* Not behind RequireAuth: the headless PDF export path has no user
              session at all (see PrintView's own token-vs-session handling). */}
          <Route path="/print/:documentId" element={<PrintView />} />
        </Routes>
      </Suspense>
      <ChatLauncher />
      <CommandPalette />
    </>
  );
}

export default App;
