import type { MathfieldElement } from "mathlive";

// MathLive registers <math-field> as a custom element (a web component, not
// a React component) — this just tells JSX it's a valid tag so we can use
// it directly and attach a ref to the underlying MathfieldElement instance.
declare global {
  namespace JSX {
    interface IntrinsicElements {
      "math-field": React.DetailedHTMLProps<React.HTMLAttributes<MathfieldElement>, MathfieldElement>;
    }
  }
}
