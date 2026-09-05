import { describe, expect, test } from "bun:test";
import { referenceFlows } from "./starter-app";
import { isGlyphLaunchAbort } from "@/lib/connectors/glyph-launch";

describe("Qubic reference workspace", () => {
  test("defines two modal starter actions with account management outside the task surface", () => {
    expect(referenceFlows.map((flow) => flow.label)).toEqual([
      "Sign & Verify",
      "Contract call",
    ]);
    expect(referenceFlows).toHaveLength(2);
  });

  test("suppresses only Chromium's known custom-protocol launch abort", () => {
    const abort = new Error("The user aborted a request.");
    abort.name = "AbortError";

    expect(isGlyphLaunchAbort(abort)).toBe(true);
    expect(isGlyphLaunchAbort(new Error("The user aborted a request."))).toBe(
      false,
    );
    expect(isGlyphLaunchAbort(new Error("A different request failed."))).toBe(
      false,
    );
  });
});
