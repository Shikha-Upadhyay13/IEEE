import { BrandMark } from "./BrandMark";

// The bare unstyled "Loading…" text every route briefly showed (during
// auth resolution, paper fetch, etc.) was the plainest thing left in the
// app — this gives it the same "§" identity the rest of the app uses
// instead of an inline-styled paragraph tag.
export function LoadingScreen({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-canvas">
      <BrandMark size="lg" className="animate-pulse" />
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}
