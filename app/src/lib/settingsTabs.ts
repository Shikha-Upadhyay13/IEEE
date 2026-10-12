export type SettingsTab = "profile" | "account" | "preferences" | "notifications" | "workspace" | "data";

export const SETTINGS_TABS: { id: SettingsTab; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "account", label: "Account & security" },
  { id: "preferences", label: "Preferences" },
  { id: "notifications", label: "Notifications" },
  { id: "workspace", label: "Workspace" },
  { id: "data", label: "Data & privacy" },
];

export function parseSettingsTab(value: string | null): SettingsTab {
  return SETTINGS_TABS.find((t) => t.id === value)?.id ?? "profile";
}
