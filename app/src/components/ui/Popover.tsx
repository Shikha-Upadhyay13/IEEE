import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

export type PopoverAlign = "start" | "end";

type Position = { top: number; left: number; maxHeight: number; placement: "below" | "above" };

const GAP = 6;
const VIEWPORT_MARGIN = 8;

// Rendered into document.body with fixed coordinates so the editor's
// overflow-y scroll containers can't clip it.
export function Popover({
  open,
  onClose,
  anchorRef,
  align = "start",
  width,
  children,
  className = "",
  labelledBy,
  role = "dialog",
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  align?: PopoverAlign;
  width?: number;
  children: ReactNode;
  className?: string;
  labelledBy?: string;
  role?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Position | null>(null);

  const reposition = useCallback(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;
    const rect = anchor.getBoundingClientRect();
    const panelWidth = width ?? panel.offsetWidth;
    const panelHeight = panel.scrollHeight;
    const spaceBelow = window.innerHeight - rect.bottom - GAP - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - GAP - VIEWPORT_MARGIN;
    const placeAbove = panelHeight > spaceBelow && spaceAbove > spaceBelow;
    const maxHeight = Math.max(120, placeAbove ? spaceAbove : spaceBelow);
    let left = align === "end" ? rect.right - panelWidth : rect.left;
    left = Math.min(Math.max(VIEWPORT_MARGIN, left), window.innerWidth - panelWidth - VIEWPORT_MARGIN);
    const top = placeAbove ? rect.top - GAP - Math.min(panelHeight, maxHeight) : rect.bottom + GAP;
    setPosition({ top, left, maxHeight, placement: placeAbove ? "above" : "below" });
  }, [anchorRef, align, width]);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    reposition();
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        anchorRef.current?.focus();
      }
    }
    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, onClose, anchorRef, reposition]);

  if (!open) return null;

  return createPortal(
    <div
      ref={panelRef}
      role={role}
      aria-labelledby={labelledBy}
      style={{
        position: "fixed",
        top: position?.top ?? -9999,
        left: position?.left ?? -9999,
        maxHeight: position?.maxHeight,
        width,
        visibility: position ? "visible" : "hidden",
      }}
      className={`z-[90] overflow-y-auto rounded-lg border border-line bg-surface text-ink shadow-lg animate-fade-in ${className}`}
    >
      {children}
    </div>,
    document.body,
  );
}
