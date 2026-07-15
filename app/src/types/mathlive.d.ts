import type { DetailedHTMLProps, HTMLAttributes } from "react";
import type { MathfieldElement } from "mathlive";

// MathLive registers <math-field> as a custom element (a web component, not
// a React component) — this just tells JSX it's a valid tag so we can use
// it directly and attach a ref to the underlying MathfieldElement instance.
//
// React 19's types moved JSX augmentation to be scoped inside the "react"
// module's own JSX namespace rather than a global ambient JSX namespace —
// `declare global { namespace JSX {...} }` silently stops merging under
// @types/react 19, so this must augment "react" directly instead.
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "math-field": DetailedHTMLProps<HTMLAttributes<MathfieldElement>, MathfieldElement>;
    }
  }
}
