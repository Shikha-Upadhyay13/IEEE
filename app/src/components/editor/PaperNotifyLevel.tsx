import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { inputBase } from "../../lib/uiClasses";
import { friendlyErrorMessage } from "../../lib/friendlyError";
import { PAPER_LEVELS, loadPaperLevel, setPaperLevel, type PaperLevel } from "../../lib/notificationPrefs";

export function PaperNotifyLevel({ documentId, userId }: { documentId: string; userId: string }) {
  const [level, setLevel] = useState<PaperLevel | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadPaperLevel(documentId)
      .then((l) => !cancelled && setLevel(l))
      .catch((err) => !cancelled && setError(friendlyErrorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  function change(next: PaperLevel) {
    const previous = level;
    setLevel(next);
    setError(null);
    setPaperLevel(userId, documentId, next).catch((err) => {
      setLevel(previous);
      setError(friendlyErrorMessage(err));
    });
  }

  return (
    <div className="px-4 py-3 border-t border-line bg-canvas">
      <label className="flex items-center gap-2 text-xs text-muted">
        <Bell size={13} aria-hidden="true" className="flex-none" />
        <span className="flex-none">Notify me about this paper</span>
        <select
          value={level ?? "all"}
          disabled={level === null}
          onChange={(e) => change(e.target.value as PaperLevel)}
          className={`${inputBase} text-xs py-1 min-w-0 flex-1 cursor-pointer`}
        >
          {PAPER_LEVELS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p role="alert" className="mt-1 text-[11px] text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
