import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import { needsSecondFactor } from "../lib/mfa";
import { LoadingScreen } from "./LoadingScreen";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!session || needsSecondFactor(session)) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
