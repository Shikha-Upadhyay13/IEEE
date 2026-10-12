import { describe, expect, it, vi } from "vitest";

vi.mock("../supabaseClient", () => ({ supabase: {} }));

import { NOTIFICATION_EVENTS, withDefaults } from "./notificationPrefs";

describe("withDefaults", () => {
  it("fills unsaved events with both channels on, keeping the settings order", () => {
    const prefs = withDefaults([{ kind: "comment", in_app: false, email: true }]);
    expect(prefs.map((p) => p.kind)).toEqual(NOTIFICATION_EVENTS.map((e) => e.kind));
    expect(prefs.find((p) => p.kind === "comment")).toEqual({ kind: "comment", in_app: false, email: true });
    expect(prefs.find((p) => p.kind === "mention")).toEqual({ kind: "mention", in_app: true, email: true });
  });
});
