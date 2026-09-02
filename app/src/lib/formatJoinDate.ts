// Shared by ProfilePage and SettingsPage's account summary — both show
// "member since" from the same auth user record.
export function formatJoinDate(iso: string | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}
