import { describe, expect, test } from "bun:test";
import { isGlyphLaunchAbort, referenceFlows } from "./StarterApp";

describe("Qubic reference workspace", () => {
  test("names exactly the three approved flows without a sidebar or starter branding", () => {
    expect(referenceFlows.map((flow) => flow.label)).toEqual(["Connect", "Buy ticket", "Sign & Verify"]);
    expect(referenceFlows).toHaveLength(3);
  });

  test("suppresses only Chromium's known custom-protocol launch abort", () => {
    const abort = new Error("The user aborted a request.");
    abort.name = "AbortError";

    expect(isGlyphLaunchAbort(abort)).toBe(true);
    expect(isGlyphLaunchAbort(new Error("The user aborted a request."))).toBe(false);
    expect(isGlyphLaunchAbort(new Error("A different request failed."))).toBe(false);
  });
});
