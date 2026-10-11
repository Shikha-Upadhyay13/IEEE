import { useEffect, useState } from "react";

const cache = new Map<string, number>();

/** Natural pixel widths of the given image URLs, filled in as each one loads. */
export function useImageWidths(urls: string[]): ReadonlyMap<string, number> {
  const key = [...new Set(urls)].sort().join("\n");
  const [widths, setWidths] = useState<ReadonlyMap<string, number>>(() => new Map(cache));

  useEffect(() => {
    let cancelled = false;
    for (const url of key ? key.split("\n") : []) {
      if (cache.has(url)) continue;
      const img = new Image();
      img.onload = () => {
        cache.set(url, img.naturalWidth);
        if (!cancelled) setWidths(new Map(cache));
      };
      img.src = url;
    }
    return () => {
      cancelled = true;
    };
  }, [key]);

  return widths;
}
