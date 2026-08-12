import { describe, expect, test } from "bun:test";
import { buildQxAddToBidOrderInput } from "@qubic.org/contracts";

describe("QX AddToBidOrder contract builder", () => {
  test("builds the authoritative QX index 1, input type 6 payload", () => {
    const call = buildQxAddToBidOrderInput(
      {
        issuer: "A".repeat(60),
        assetName: BigInt(0),
        price: BigInt(1),
        numberOfShares: BigInt(1),
      },
      () => new Uint8Array(32),
    );

    expect(call.contractIndex).toBe(1);
    expect(call.inputType).toBe(6);
    expect(call.payload).toBeInstanceOf(Uint8Array);
    expect(call.payload.byteLength).toBe(56);
  });
});
