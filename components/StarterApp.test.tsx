import { describe, expect, test } from "bun:test";
import { referenceFlows } from "./StarterApp";

describe("Qubic reference workspace", () => {
  test("names exactly the three approved flows without a sidebar or starter branding", () => {
    expect(referenceFlows.map((flow) => flow.label)).toEqual(["Connect", "Buy ticket", "Sign & Verify"]);
    expect(referenceFlows).toHaveLength(3);
  });
});
