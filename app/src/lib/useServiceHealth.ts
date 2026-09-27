import { useEffect, useState } from "react";

const HEALTH_TIMEOUT_MS = 5000;

export type ServiceHealth = "checking" | "up" | "down";

// Pings Supabase's auth health endpoint once so the login page can warn
// before the user types credentials into a form that is guaranteed to fail.
export function useServiceHealth(): ServiceHealth {
  const [health, setHealth] = useState<ServiceHealth>("checking");

  useEffect(() => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !anonKey) return;
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
    fetch(`${url}/auth/v1/health`, { headers: { apikey: anonKey }, signal: controller.signal })
      .then((res) => {
        if (!cancelled) setHealth(res.ok ? "up" : "down");
      })
      .catch(() => {
        if (!cancelled) setHealth("down");
      })
      .finally(() => clearTimeout(timer));
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, []);

  return health;
}
