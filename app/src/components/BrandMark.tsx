const SIZE = {
  sm: "w-6 h-6 text-xs rounded-md",
  md: "w-8 h-8 text-sm rounded-md",
  lg: "w-10 h-10 text-xl rounded-lg",
} as const;

export function BrandMark({
  size = "md",
  className = "",
}: {
  size?: keyof typeof SIZE;
  className?: string;
}) {
  return (
    <div
      className={`${SIZE[size]} bg-accent text-accent-fg flex items-center justify-center font-serif flex-none ${className}`}
    >
      §
    </div>
  );
}
