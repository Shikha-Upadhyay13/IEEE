// Small shared set of Tailwind class strings so buttons/inputs/labels stay
// visually consistent across the app without pulling in a full component
// library — just enough of a design system for a solo-maintained project.
const btnBase =
  "inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed";

// Dark: variants live directly on these shared constants now that dark mode
// is app-wide (previously scoped to only the AI Assistant section, where
// adding dark: here would have leaked into pages that had no dark
// background of their own to sit on — see useTheme.tsx's history). Every
// page opts in via the same global `.dark` class now, so this is safe.
export const btnPrimary = `${btnBase} bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500 px-3 py-1.5`;
export const btnSecondary = `${btnBase} bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 focus:ring-indigo-500 px-3 py-1.5`;
export const btnDanger = `${btnBase} text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 focus:ring-red-500 px-2 py-1`;
// Solid variant, for a destructive action that's the primary/only obvious
// choice in its context (e.g. a confirmation dialog's "Delete" button) —
// btnDanger's ghost style reads as secondary, not as the thing being asked.
export const btnDangerSolid = `${btnBase} bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 px-3 py-1.5`;
export const btnGhost = `${btnBase} text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 focus:ring-gray-400 px-2 py-1`;
export const btnIcon = `${btnBase} text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300 focus:ring-gray-400 w-7 h-7 p-0`;

export const inputBase =
  "block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none";

export const labelBase = "block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1";

export const cardBase = "bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm";
