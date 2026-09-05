import { describe, expect, test } from "bun:test";
import {
  CONTRACT_CALL_DEFINITIONS,
  contractCallDefinition,
  qubicExplorerTransactionUrl,
} from "./contract-call";

describe("registered contract-call templates", () => {
  test("keeps a zero-value, ABI-reviewed starter request in source", () => {
    expect(CONTRACT_CALL_DEFINITIONS).toEqual([
      expect.objectContaining({
        id: "zero-value-template",
        request: {
          contractIndex: 0,
          inputType: 0,
          amount: "0",
        },
      }),
    ]);
    expect(contractCallDefinition("zero-value-template")).toBe(
      CONTRACT_CALL_DEFINITIONS[0],
    );
    expect(contractCallDefinition("missing")).toBeUndefined();
  });

  test("uses the public Explorer transaction route without changing the id", () => {
    expect(qubicExplorerTransactionUrl("abc-123")).toBe(
      "https://explorer.qubic.org/network/mainnet/tx/abc-123",
    );
  });
});
