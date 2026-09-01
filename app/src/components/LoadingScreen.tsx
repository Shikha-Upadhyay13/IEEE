// The bare unstyled "Loading…" text every route briefly showed (during
// auth resolution, paper fetch, etc.) was the plainest thing left in the
// app — this gives it the same "§" identity the rest of the app uses
// instead of an inline-styled paragraph tag.
export function LoadingScreen({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[#f7f6f3] dark:bg-gray-950">
      <div className="w-10 h-10 rounded-lg bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center font-serif text-xl animate-pulse">
        §
      </div>
      <p className="text-sm text-gray-400 dark:text-gray-500">{label}</p>
    </div>
  );
}
