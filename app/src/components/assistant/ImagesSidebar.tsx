import { AiSectionNav } from "./AiSectionNav";
import { ProfileMenu } from "./ProfileMenu";

// A slimmed-down twin of ConversationSidebar for the Images page — same
// section switcher and profile menu, but no chat history/projects list
// (those are chat-specific), so the two AI pages still read as one product.
export function ImagesSidebar({ userEmail, onSignOut }: { userEmail: string | null; onSignOut: () => void }) {
  return (
    <div className="w-64 flex-none h-full flex flex-col bg-gray-900 text-gray-300">
      <AiSectionNav />
      <div className="flex-1 min-h-0" />
      <ProfileMenu userEmail={userEmail} onSignOut={onSignOut} />
    </div>
  );
}
