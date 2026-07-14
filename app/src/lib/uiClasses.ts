// Small shared set of Tailwind class strings so buttons/inputs/labels stay
// visually consistent across the app without pulling in a full component
// library — just enough of a design system for a solo-maintained project.
const btnBase =
  "inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed";

export const btnPrimary = `${btnBase} bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500 px-3 py-1.5`;
export const btnSecondary = `${btnBase} bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-indigo-500 px-3 py-1.5`;
export const btnDanger = `${btnBase} text-red-600 hover:bg-red-50 focus:ring-red-500 px-2 py-1`;
export const btnGhost = `${btnBase} text-gray-500 hover:bg-gray-100 focus:ring-gray-400 px-2 py-1`;
export const btnIcon = `${btnBase} text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:ring-gray-400 w-7 h-7 p-0`;

export const inputBase =
  "block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none";

export const labelBase = "block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1";

export const cardBase = "bg-white rounded-lg border border-gray-200 shadow-sm";
