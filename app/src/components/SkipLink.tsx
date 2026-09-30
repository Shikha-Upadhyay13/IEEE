import type { MouseEvent } from "react";

// Pages mark their primary region with id="main-content"; ones that don't
// fall back to the first <main> or <h1>, so the link is never a dead end.
function findMainTarget(): HTMLElement | null {
  return (
    document.getElementById("main-content") ??
    document.querySelector<HTMLElement>("main") ??
    document.querySelector<HTMLElement>("h1")
  );
}

export function SkipLink() {
  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    const target = findMainTarget();
    if (!target) return;
    e.preventDefault();
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus();
    target.scrollIntoView({ block: "start" });
  }

  return (
    <a
      href="#main-content"
      onClick={handleClick}
      className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-accent-fg focus:shadow-lg"
    >
      Skip to main content
    </a>
  );
}
