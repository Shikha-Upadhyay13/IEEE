// Small shared set of Tailwind class strings so buttons/inputs/labels stay
// visually consistent across the app without pulling in a full component
// library — just enough of a design system for a solo-maintained project.
const btnBase =
  "inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed";

// Accent is academic navy (cream paper canvas) — see index.css tokens.
// Semantic red / emerald / amber stay for danger, success, and warnings.
export const btnPrimary = `${btnBase} bg-accent text-accent-fg hover:bg-accent-hover focus:ring-accent px-3 py-1.5`;
export const btnSecondary = `${btnBase} bg-surface text-ink border border-line hover:bg-canvas focus:ring-accent px-3 py-1.5`;
export const btnDanger = `${btnBase} text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 focus:ring-red-500 px-2 py-1`;
export const btnDangerSolid = `${btnBase} bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 px-3 py-1.5`;
export const btnGhost = `${btnBase} text-muted hover:bg-canvas hover:text-ink focus:ring-accent px-2 py-1`;
export const btnIcon = `${btnBase} text-muted hover:bg-canvas hover:text-ink focus:ring-accent w-7 h-7 p-0`;

export const inputBase =
  "block w-full rounded-md border border-line bg-surface text-ink px-3 py-2 text-sm shadow-sm placeholder:text-muted/70 focus:border-accent focus:ring-2 focus:ring-accent/40 focus:outline-none";

export const labelBase = "block text-xs font-semibold uppercase tracking-wide text-muted mb-1";

export const cardBase = "bg-surface rounded-lg border border-line shadow-sm";

export const pageShell = "min-h-screen bg-canvas text-ink";
