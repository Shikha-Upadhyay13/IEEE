import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Popover, type PopoverAlign } from "./Popover";

export type MenuItem = {
  id: string;
  label: string;
  /** Secondary text shown under the label. */
  description?: string;
  icon?: LucideIcon;
  disabled?: boolean;
  onSelect: () => void;
};

export type MenuGroup = { label?: string; items: MenuItem[] };

// Lists longer than this get a filter box; short menus stay one keystroke away.
const SEARCH_THRESHOLD = 8;

export function Menu({
  trigger,
  triggerLabel,
  triggerClassName = "",
  groups,
  emptyMessage = "Nothing here yet.",
  align = "start",
  width = 260,
  disabled = false,
  title,
}: {
  trigger: ReactNode;
  /** Accessible name for the trigger when its content is icon-only. */
  triggerLabel?: string;
  triggerClassName?: string;
  groups: MenuGroup[];
  emptyMessage?: string;
  align?: PopoverAlign;
  width?: number;
  disabled?: boolean;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const totalItems = groups.reduce((n, g) => n + g.items.length, 0);
  const searchable = totalItems > SEARCH_THRESHOLD;

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (item) => item.label.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, query]);

  const flatItems = useMemo(() => filteredGroups.flatMap((g) => g.items), [filteredGroups]);
  const enabledIndices = useMemo(
    () => flatItems.map((item, i) => (item.disabled ? -1 : i)).filter((i) => i >= 0),
    [flatItems],
  );

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      if (searchable) searchRef.current?.focus();
      else listRef.current?.focus();
    });
  }, [open, searchable]);

  function openMenu() {
    setQuery("");
    setActiveIndex(enabledIndices[0] ?? 0);
    setOpen(true);
  }

  function close() {
    setOpen(false);
  }

  function select(item: MenuItem) {
    if (item.disabled) return;
    close();
    triggerRef.current?.focus();
    item.onSelect();
  }

  function moveActive(delta: 1 | -1) {
    if (enabledIndices.length === 0) return;
    const pos = enabledIndices.indexOf(activeIndex);
    const next = pos === -1 ? 0 : (pos + delta + enabledIndices.length) % enabledIndices.length;
    setActiveIndex(enabledIndices[next]);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveActive(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveActive(-1);
    } else if (e.key === "Home") {
      e.preventDefault();
      if (enabledIndices.length) setActiveIndex(enabledIndices[0]);
    } else if (e.key === "End") {
      e.preventDefault();
      if (enabledIndices.length) setActiveIndex(enabledIndices[enabledIndices.length - 1]);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flatItems[activeIndex];
      if (item) select(item);
    } else if (e.key === "Tab") {
      close();
    }
  }

  function handleTriggerKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      openMenu();
    }
  }

  let flatIndex = -1;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={triggerLabel}
        title={title}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={handleTriggerKeyDown}
        className={triggerClassName}
      >
        {trigger}
      </button>
      <Popover open={open} onClose={close} anchorRef={triggerRef} align={align} width={width} role="presentation">
        {searchable && (
          <div className="sticky top-0 border-b border-line bg-surface p-1.5">
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Filter…"
              aria-label="Filter options"
              className="w-full rounded-md border border-line bg-canvas px-2 py-1 text-sm placeholder:text-muted/70 focus:border-accent focus:outline-none"
            />
          </div>
        )}
        <div
          ref={listRef}
          id={menuId}
          role="menu"
          tabIndex={-1}
          onKeyDown={handleKeyDown}
          aria-activedescendant={flatItems[activeIndex] ? `${menuId}-${flatItems[activeIndex].id}` : undefined}
          className="py-1 focus:outline-none"
        >
          {flatItems.length === 0 && <p className="px-3 py-2 text-xs text-muted">{emptyMessage}</p>}
          {filteredGroups.map((group, gi) => (
            <div key={group.label ?? gi} role="group" aria-label={group.label}>
              {group.label && (
                <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                  {group.label}
                </p>
              )}
              {group.items.map((item) => {
                flatIndex += 1;
                const index = flatIndex;
                const active = index === activeIndex && !item.disabled;
                const Icon = item.icon;
                return (
                  <div
                    key={item.id}
                    id={`${menuId}-${item.id}`}
                    role="menuitem"
                    aria-disabled={item.disabled || undefined}
                    onMouseEnter={() => !item.disabled && setActiveIndex(index)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => select(item)}
                    className={`mx-1 flex items-start gap-2 rounded-md px-2 py-1.5 text-sm ${
                      item.disabled
                        ? "cursor-default text-muted"
                        : active
                          ? "cursor-pointer bg-accent-soft text-accent"
                          : "cursor-pointer text-ink"
                    }`}
                  >
                    {Icon && <Icon size={15} className="mt-0.5 flex-none" aria-hidden="true" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{item.label}</span>
                      {item.description && (
                        <span className="block truncate text-xs text-muted">{item.description}</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </Popover>
    </>
  );
}
