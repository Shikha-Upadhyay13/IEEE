import { usePageMeta } from "../lib/usePageMeta";
import { useRef, type KeyboardEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import { supabase } from "../supabaseClient";
import { pageShell } from "../lib/uiClasses";
import { SETTINGS_TABS, parseSettingsTab, type SettingsTab } from "../lib/settingsTabs";
import { DashboardSidebar } from "../components/dashboard/DashboardSidebar";
import { NotificationSettings } from "../components/settings/NotificationSettings";
import { ProfileTab } from "../components/settings/ProfileTab";
import { AccountTab } from "../components/settings/AccountTab";
import { PreferencesTab } from "../components/settings/PreferencesTab";
import { WorkspaceTab } from "../components/settings/WorkspaceTab";
import { DataPrivacyTab } from "../components/settings/DataPrivacyTab";

export function SettingsPage() {
  usePageMeta({ title: "Settings", noindex: true });
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = parseSettingsTab(params.get("tab"));
  const tabRefs = useRef(new Map<SettingsTab, HTMLButtonElement>());

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  function select(next: SettingsTab) {
    setParams(next === "profile" ? {} : { tab: next }, { replace: true });
  }

  function onTabKey(e: KeyboardEvent) {
    const index = SETTINGS_TABS.findIndex((t) => t.id === tab);
    const step = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = SETTINGS_TABS[(index + step + SETTINGS_TABS.length) % SETTINGS_TABS.length].id;
    select(next);
    tabRefs.current.get(next)?.focus();
  }

  return (
    <div className={`${pageShell} flex flex-col md:flex-row`}>
      <DashboardSidebar onSignOut={handleSignOut} />

      <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 px-4 py-6 sm:px-8 sm:py-10 focus:outline-none">
        <h1 className="font-display text-2xl font-semibold text-ink tracking-tight mb-1">Settings</h1>
        <p className="text-sm text-muted mb-6">Your profile, account, preferences and notifications.</p>

        <div className="flex flex-col lg:flex-row gap-6">
          <div
            role="tablist"
            aria-label="Settings sections"
            aria-orientation="vertical"
            onKeyDown={onTabKey}
            className="flex lg:flex-col gap-1 overflow-x-auto lg:w-52 flex-none -mx-1 px-1"
          >
            {SETTINGS_TABS.map((t) => (
              <button
                key={t.id}
                ref={(el) => {
                  if (el) tabRefs.current.set(t.id, el);
                }}
                id={`settings-tab-${t.id}`}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                aria-controls="settings-panel"
                tabIndex={tab === t.id ? 0 : -1}
                onClick={() => select(t.id)}
                className={`whitespace-nowrap text-left rounded-lg px-3 py-2 text-sm transition-colors ${
                  tab === t.id ? "bg-accent-soft text-accent font-medium" : "text-muted hover:bg-canvas hover:text-ink"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div id="settings-panel" role="tabpanel" aria-labelledby={`settings-tab-${tab}`} className="flex-1 min-w-0">
            {user && tab === "profile" && <ProfileTab userId={user.id} email={user.email} />}
            {user && tab === "account" && <AccountTab user={user} onSignOut={handleSignOut} />}
            {tab === "preferences" && <PreferencesTab userId={user?.id} />}
            {user && tab === "notifications" && <NotificationSettings userId={user.id} className="max-w-2xl" />}
            {user && tab === "workspace" && <WorkspaceTab userId={user.id} />}
            {user && tab === "data" && <DataPrivacyTab userId={user.id} />}
          </div>
        </div>
      </main>
    </div>
  );
}
