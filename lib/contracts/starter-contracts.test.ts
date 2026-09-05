import { publicKeyToIdentity } from "@qubic.org/crypto";
import { describe, expect, test } from "bun:test";
import {
  payloadToBase64,
  prepareStarterContractProcedure,
  STARTER_CONTRACT_ACTIONS,
  STARTER_CONTRACTS,
  starterContractActionsFor,
  stringifyContractResult,
} from "./starter-contracts";

const identity = publicKeyToIdentity(new Uint8Array(32));

describe("reviewed QEarn and QUtil starter examples", () => {
  test("limits the catalog to the two selected contracts and their actions", () => {
    expect(STARTER_CONTRACTS.map((contract) => contract.id)).toEqual([
      "qearn",
      "q-util",
    ]);
    expect(STARTER_CONTRACT_ACTIONS.map((action) => action.id)).toEqual([
      "qearn-stats",
      "qearn-lock",
      "q-util-fees",
      "q-util-vote",
    ]);
    expect(starterContractActionsFor("qearn")).toHaveLength(2);
    expect(starterContractActionsFor("q-util")).toHaveLength(2);
  });

  test("builds the QEarn lock request from the generated contract constants", () => {
    expect(
      prepareStarterContractProcedure(
        "qearn-lock",
        { amount: "1000000" },
        identity,
      ),
    ).toEqual({
      label: "Lock QU",
      contractIndex: 9,
      inputType: 1,
      amount: "1000000",
    });
  });

  test("builds the QUtil vote payload with the connected identity", () => {
    const procedure = prepareStarterContractProcedure(
      "q-util-vote",
      { pollId: "4", option: "2", amount: "0" },
      identity,
    );

    expect(procedure).toMatchObject({
      label: "Vote in a poll",
      contractIndex: 4,
      inputType: 5,
      amount: "0",
    });
    expect(procedure.payload).toBeInstanceOf(Uint8Array);
    expect(procedure.payload).toHaveLength(56);
    expect(payloadToBase64(procedure.payload ?? new Uint8Array())).toHaveLength(
      76,
    );
  });

  test("rejects malformed and unsafe procedure inputs before a wallet request", () => {
    expect(() =>
      prepareStarterContractProcedure("qearn-lock", { amount: "0" }, identity),
    ).toThrow("Amount must be at least 1.");
    expect(() =>
      prepareStarterContractProcedure(
        "q-util-vote",
        { pollId: "1", option: "-1", amount: "0" },
        identity,
      ),
    ).toThrow("Option must be a whole number.");
  });

  test("preserves bigint results for the query display", () => {
    expect(
      stringifyContractResult({ fee: BigInt("1234567890123456789") }),
    ).toBe('{\n  "fee": "1234567890123456789"\n}');
  });
});
