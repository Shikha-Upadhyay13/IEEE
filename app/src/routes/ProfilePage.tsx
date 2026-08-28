import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import { supabase } from "../supabaseClient";
import { btnSecondary } from "../lib/uiClasses";

function formatJoinDate(iso: string | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-[#f7f6f3] dark:bg-gray-950">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <Link
          to="/dashboard"
          className="text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
        >
          ← Dashboard
        </Link>

        <div className="bg-white dark:bg-gray-900 dark:border-gray-800 rounded-xl border border-gray-200 shadow-sm p-6 mt-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 dark:from-gray-300 dark:to-gray-100 text-white dark:text-gray-900 flex items-center justify-center text-2xl font-semibold flex-none">
              {user?.email?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {user?.email ?? "Your account"}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Member since {formatJoinDate(user?.created_at)}
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-[120px_1fr] gap-y-3 text-sm border-t border-gray-100 dark:border-gray-800 pt-4">
            <dt className="text-gray-400 dark:text-gray-500">Email</dt>
            <dd className="text-gray-800 dark:text-gray-200">{user?.email ?? "—"}</dd>
            <dt className="text-gray-400 dark:text-gray-500">User ID</dt>
            <dd className="text-gray-500 dark:text-gray-400 font-mono text-xs break-all">{user?.id ?? "—"}</dd>
          </dl>

          <div className="border-t border-gray-100 dark:border-gray-800 mt-6 pt-6 flex justify-between items-center">
            <Link
              to="/settings"
              className="text-sm text-gray-900 dark:text-gray-100 hover:underline font-medium"
            >
              Go to Settings →
            </Link>
            <button
              onClick={handleSignOut}
              className={`${btnSecondary} dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700 dark:hover:bg-gray-700`}
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
