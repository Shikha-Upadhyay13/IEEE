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
    <math-field
      ref={ref}
      className="w-full rounded-md border border-gray-300 px-3 py-2 text-base focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500"
    />
  );
}
