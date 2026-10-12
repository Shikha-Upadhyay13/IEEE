import { describe, expect, it } from "vitest";
import { parseSettingsTab } from "./settingsTabs";

describe("parseSettingsTab", () => {
  it("opens the requested tab, or Profile for anything unknown", () => {
    expect(parseSettingsTab("notifications")).toBe("notifications");
    expect(parseSettingsTab("billing")).toBe("profile");
    expect(parseSettingsTab(null)).toBe("profile");
  });
});
