import { describe, expect, test } from "bun:test";
import { referenceFlows } from "./starter-app";
import { isGlyphLaunchAbort } from "@/lib/connectors/glyph-launch";

describe("Qubic reference workspace", () => {
  test("offers two task-first examples with account management outside navigation", () => {
    expect(referenceFlows.map((flow) => flow.label)).toEqual([
      "Sign & Verify",
      "RandomLottery",
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
