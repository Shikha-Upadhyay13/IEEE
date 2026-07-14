import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/useAuth";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) return <p style={{ padding: 16 }}>Loading…</p>;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
