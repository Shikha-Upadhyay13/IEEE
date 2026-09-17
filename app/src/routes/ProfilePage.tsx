import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import { supabase } from "../supabaseClient";
import { btnSecondary, cardBase, pageShell } from "../lib/uiClasses";
import { formatJoinDate } from "../lib/formatJoinDate";
import { DashboardSidebar } from "../components/dashboard/DashboardSidebar";

export function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  return (
    <div className={`${pageShell} flex flex-col md:flex-row`}>
      <DashboardSidebar onSignOut={handleSignOut} />

      <div className="flex-1 min-w-0 px-4 py-6 sm:px-8 sm:py-10">
        <div className="max-w-2xl">
          <h1 className="font-display text-2xl font-semibold text-ink tracking-tight mb-1">My account</h1>
          <p className="text-sm text-muted mb-6">Account details for the signed-in session.</p>

          <div className={`${cardBase} p-6`}>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-accent text-accent-fg flex items-center justify-center text-2xl font-semibold flex-none">
                {user?.email?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-ink">{user?.email ?? "Your account"}</h2>
                <p className="text-sm text-muted">Member since {formatJoinDate(user?.created_at)}</p>
              </div>
            </div>

            <dl className="grid grid-cols-[120px_1fr] gap-y-3 text-sm border-t border-line pt-4">
              <dt className="text-muted">Email</dt>
              <dd className="text-ink">{user?.email ?? "—"}</dd>
              <dt className="text-muted">User ID</dt>
              <dd className="text-muted font-mono text-xs break-all">{user?.id ?? "—"}</dd>
            </dl>

            <div className="border-t border-line mt-6 pt-6 flex justify-between items-center">
              <Link to="/settings" className="text-sm text-accent hover:text-accent-hover hover:underline font-medium">
                Go to Settings →
              </Link>
              <button onClick={handleSignOut} className={btnSecondary}>
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
