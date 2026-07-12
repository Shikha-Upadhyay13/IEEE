import { useEffect, useState } from "react";

// Re-pagination is not free (Paged.js re-chunks the whole document), so the
// live preview should follow edits after a short pause, not on every keystroke.
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
