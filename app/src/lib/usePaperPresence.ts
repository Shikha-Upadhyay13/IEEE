import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export type PresentEditor = { userId: string; email: string; since: string };
type Meta = { email?: string; since?: string };

/** Everyone in the channel except me, one entry per person (several tabs collapse), longest-present first. */
export function othersFromPresence(state: Record<string, Meta[]>, myId: string): PresentEditor[] {
  return Object.entries(state)
    .filter(([userId, metas]) => userId !== myId && metas.length > 0)
    .map(([userId, metas]) => {
      const since = metas.map((m) => m.since ?? "").filter(Boolean).sort()[0] ?? "";
      return { userId, email: metas.find((m) => m.email)?.email ?? "A co-author", since };
    })
    .sort((a, b) => a.since.localeCompare(b.since));
}

/** Who else has this paper open right now — a soft lock, nothing is blocked. */
export function usePaperPresence(documentId: string | undefined, me: { id: string; email?: string } | null): PresentEditor[] {
  const [others, setOthers] = useState<PresentEditor[]>([]);
  const myId = me?.id;
  const myEmail = me?.email;

  useEffect(() => {
    if (!documentId || !myId) return;
    const channel = supabase.channel(`paper:${documentId}`, {
      config: { private: true, presence: { key: myId } },
    });
    channel
      .on("presence", { event: "sync" }, () => setOthers(othersFromPresence(channel.presenceState<Meta>(), myId)))
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void channel.track({ email: myEmail ?? "", since: new Date().toISOString() });
      });
    return () => {
      setOthers([]);
      void supabase.removeChannel(channel);
    };
  }, [documentId, myId, myEmail]);

  return others;
}
