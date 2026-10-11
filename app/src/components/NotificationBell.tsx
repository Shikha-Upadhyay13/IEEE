import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../lib/useAuth";
import { Popover } from "./ui/Popover";
import { relativeTime } from "../lib/relativeTime";
import {
  describe,
  destination,
  fromRow,
  listNotifications,
  markAllRead,
  markRead,
  type Notification,
} from "../lib/notifications";

export function NotificationBell({ className = "" }: { className?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const unread = items.filter((n) => !n.readAt).length;
  const userId = user?.id;
  const instanceId = useId();

  const refresh = useCallback(() => {
    listNotifications()
      .then(setItems)
      .catch((err) => console.warn("Couldn't load notifications:", err));
  }, []);

  useEffect(() => {
    if (!userId) return;
    refresh();
    const channel = supabase
      .channel(`notifications:${userId}:${instanceId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (change) => setItems((prev) => [fromRow(change.new as Parameters<typeof fromRow>[0]), ...prev].slice(0, 50)),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, instanceId, refresh]);

  function stamp(ids: string[]) {
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (ids.includes(n.id) && !n.readAt ? { ...n, readAt: now } : n)));
  }

  function openItem(n: Notification) {
    setOpen(false);
    if (!n.readAt) {
      stamp([n.id]);
      markRead([n.id]).catch((err) => console.warn("Couldn't mark notification read:", err));
    }
    navigate(destination(n));
  }

  function readAll() {
    stamp(items.map((n) => n.id));
    markAllRead().catch((err) => {
      console.warn("Couldn't mark notifications read:", err);
      refresh();
    });
  }

  if (!userId) return null;

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`relative w-8 h-8 flex items-center justify-center rounded-md text-muted hover:text-ink hover:bg-canvas transition-colors ${className}`}
      >
        <Bell size={16} aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-accent text-accent-fg text-[10px] font-semibold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} align="end" width={340} labelledBy="notifications-title">
        <div className="flex items-center justify-between px-3 py-2 border-b border-line">
          <h2 id="notifications-title" className="text-xs font-semibold text-ink">
            Notifications
          </h2>
          {unread > 0 && (
            <button type="button" onClick={readAll} className="text-[11px] text-accent hover:underline">
              Mark all read
            </button>
          )}
        </div>
        {items.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted">You're all caught up.</p>
        ) : (
          <ul className="py-1">
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => openItem(n)}
                  className="w-full flex gap-2 px-3 py-2 text-left hover:bg-canvas"
                >
                  <span
                    className={`mt-1.5 w-1.5 h-1.5 flex-none rounded-full ${n.readAt ? "bg-transparent" : "bg-accent"}`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-xs ${n.readAt ? "text-muted" : "text-ink"}`}>
                      <span className="font-medium">{n.payload.actor ?? "Someone"}</span> {describe(n)}
                    </span>
                    {n.payload.excerpt && <span className="block text-[11px] text-muted truncate">{n.payload.excerpt}</span>}
                    <span className="block text-[10px] text-muted mt-0.5">{relativeTime(n.createdAt)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Popover>
    </>
  );
}
