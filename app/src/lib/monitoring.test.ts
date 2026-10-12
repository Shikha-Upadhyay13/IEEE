import { describe, expect, it } from "vitest";
import { tracesSampleRate } from "./monitoring";

describe("tracesSampleRate", () => {
  it("uses a configured rate between 0 and 1", () => {
    expect(tracesSampleRate("0.25")).toBe(0.25);
    expect(tracesSampleRate("0")).toBe(0);
    expect(tracesSampleRate("1")).toBe(1);
  });

  it("falls back to 10% when unset or invalid", () => {
    for (const value of [undefined, "", " ", "abc", "-1", "2"]) expect(tracesSampleRate(value)).toBe(0.1);
  });
});
