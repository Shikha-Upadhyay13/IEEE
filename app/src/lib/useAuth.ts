import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../supabaseClient";

// If Supabase is unreachable (DNS/offline/paused project), getSession can
// hang while retrying token refresh — without a timeout the whole app stays
// on LoadingScreen forever and looks like it "won't open".
const AUTH_TIMEOUT_MS = 4000;

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const timeout = window.setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, AUTH_TIMEOUT_MS);

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return;
        setSession(data.session);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Auth session check failed:", err);
        if (!cancelled) setLoading(false);
      })
      .finally(() => {
        window.clearTimeout(timeout);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!cancelled) setSession(newSession);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      listener.subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null, loading };
}
