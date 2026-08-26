import { useCallback, useEffect, useRef, useState } from "react";
import { btnDangerSolid, btnSecondary } from "../lib/uiClasses";

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  /** Set false for a non-destructive confirmation — swaps the solid red
   *  confirm button for the ordinary secondary style. */
  danger?: boolean;
};

/**
 * Promise-based replacement for window.confirm — same call shape at the
 * usage site (`if (!(await confirm(...))) return;`), but renders as a
 * styled modal instead of the browser's native (often jarring, sometimes
 * literally black depending on OS/theme) confirm popup.
 *
 * Each caller owns its own instance (no global singleton): call the hook,
 * render {ConfirmDialog} once in that component's JSX tree, and await
 * confirm() wherever a destructive action needs a yes/no gate.
 */
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback((opts: ConfirmOptions | string) => {
    setOptions(typeof opts === "string" ? { message: opts } : opts);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  function settle(result: boolean) {
    setOptions(null);
    resolveRef.current?.(result);
    resolveRef.current = null;
  }

  // Cancel is the default focus target — an accidental Enter keypress
  // should never trigger the destructive action.
  useEffect(() => {
    if (!options) return;
    cancelButtonRef.current?.focus();
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") settle(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [options]);

  const ConfirmDialog = options ? (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4"
      onClick={() => settle(false)}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-sm w-full p-5 animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        {options.title && (
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1.5">{options.title}</h3>
        )}
        <p className="text-sm text-gray-600 dark:text-gray-400">{options.message}</p>
        <div className="flex justify-end gap-2 mt-5">
          <button ref={cancelButtonRef} onClick={() => settle(false)} className={btnSecondary}>
            Cancel
          </button>
          <button
            onClick={() => settle(true)}
            className={options.danger === false ? btnSecondary : btnDangerSolid}
          >
            {options.confirmLabel ?? "Delete"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, ConfirmDialog };
}
