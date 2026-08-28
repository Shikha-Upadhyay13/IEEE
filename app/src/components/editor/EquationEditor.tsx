import { useEffect, useRef } from "react";
import type { MathfieldElement } from "mathlive";
import "mathlive"; // registers the <math-field> custom element

export function EquationEditor({
  latex,
  onChange,
}: {
  latex: string;
  onChange: (latex: string) => void;
}) {
  const ref = useRef<MathfieldElement>(null);

  // Wire the input listener once — MathLive fires its own "input" event
  // (not a React SyntheticEvent) since <math-field> is a real custom element,
  // not a React component.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handleInput = () => onChange(el.value);
    el.addEventListener("input", handleInput);
    return () => el.removeEventListener("input", handleInput);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the field in sync if `latex` changes from outside this component
  // (e.g. loading a different equation block) — guarded so it doesn't fight
  // the user's own typing by resetting the field to its own current value.
  useEffect(() => {
    if (ref.current && ref.current.value !== latex) {
      ref.current.value = latex;
    }
  }, [latex]);

  return (
    // MathLive's <math-field> renders its math content in a shadow root with
    // its own theming — the host element's own border/background do follow
    // dark: normally, but the typeset glyph color itself is only inherited
    // if MathLive picks up `color`, not guaranteed for every render mode.
    <math-field
      ref={ref}
      className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-3 py-2 text-base focus-within:border-gray-500 dark:focus-within:border-gray-400 focus-within:ring-2 focus-within:ring-gray-400/50 dark:focus-within:ring-gray-600/50"
    />
  );
}
