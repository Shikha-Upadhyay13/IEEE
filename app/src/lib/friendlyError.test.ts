import { describe, expect, it } from "vitest";
import { friendlyErrorMessage, isNetworkError, SERVICE_UNAVAILABLE_MESSAGE } from "./friendlyError";

describe("friendlyErrorMessage", () => {
  it("maps browser fetch failures to the service-unavailable message", () => {
    expect(friendlyErrorMessage(new TypeError("Failed to fetch"))).toBe(SERVICE_UNAVAILABLE_MESSAGE);
    expect(friendlyErrorMessage(new TypeError("NetworkError when attempting to fetch resource."))).toBe(
      SERVICE_UNAVAILABLE_MESSAGE,
    );
    expect(friendlyErrorMessage(new TypeError("Load failed"))).toBe(SERVICE_UNAVAILABLE_MESSAGE);
  });

  it("recognises supabase's retryable fetch error by name", () => {
    const err = Object.assign(new Error("{}"), { name: "AuthRetryableFetchError", status: 0 });
    expect(isNetworkError(err)).toBe(true);
  });

  it("keeps meaningful server messages", () => {
    expect(friendlyErrorMessage(new Error("Invalid login credentials"))).toBe("Invalid login credentials");
  });

  it("falls back for empty or unknown errors", () => {
    expect(friendlyErrorMessage(new Error("{}"), "Upload failed")).toBe("Upload failed");
    expect(friendlyErrorMessage("nope", "Upload failed")).toBe("Upload failed");
    expect(friendlyErrorMessage(null)).toBe("Something went wrong. Please try again.");
  });
});
