import { useEffect, useRef, useState } from "react";
import { supabase } from "../../supabaseClient";
import { btnPrimary, btnSecondary } from "../../lib/uiClasses";

interface ShareButtonProps {
  documentId: string;
}

export function ShareButton({ documentId }: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const shareUrl = `${window.location.origin}/view/${documentId}`;

  // Load initial share state whenever popover opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function checkPublic() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("documents")
          .select("is_public")
          .eq("id", documentId)
          .single();

        if (!cancelled && !error && data) {
          setIsPublic(Boolean(data.is_public));
        }
      } catch (err) {
        console.warn("Could not check is_public state:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    checkPublic();

    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    window.document.addEventListener("mousedown", handleClickOutside);
    return () => {
      cancelled = true;
      window.document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open, documentId]);

  async function handleTogglePublic() {
    const nextState = !isPublic;
    setIsPublic(nextState); // optimistic
    try {
      const { error } = await supabase
        .from("documents")
        .update({ is_public: nextState })
        .eq("id", documentId);

      if (error) {
        console.error("Failed to update public status:", error);
        setIsPublic(!nextState); // rollback
      }
    } catch (err) {
      console.error("Failed to update public status:", err);
      setIsPublic(!nextState);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  }

  return (
    <div className="relative inline-block" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`${btnSecondary} text-xs py-1.5 px-3 flex items-center gap-1.5`}
        title="Share paper"
      >
        <span className="text-sm">🔗</span>
        <span>Share</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
            <div>
              <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100">Share this paper</h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Read-only link for co-authors & reviewers</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm"
            >
              ✕
            </button>
          </div>

          <div className="py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-gray-800 dark:text-gray-200">Public link access</p>
                <p className="text-[11px] text-gray-400 dark:text-gray-500">
                  {isPublic ? "Anyone with the link can read" : "Only you can view"}
                </p>
              </div>

              <button
                type="button"
                onClick={handleTogglePublic}
                disabled={loading}
                aria-pressed={isPublic}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isPublic ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-700"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isPublic ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {isPublic && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-1.5 p-1.5 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="flex-1 bg-transparent text-[11px] text-gray-600 dark:text-gray-300 outline-none px-1 select-all"
                  />
                  <button
                    type="button"
                    onClick={handleCopy}
                    className={`${btnPrimary} text-[11px] py-1 px-2.5 flex-none`}
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 italic">
                  Recipients view your paper formatted in IEEE 2-column layout without needing to sign in.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
