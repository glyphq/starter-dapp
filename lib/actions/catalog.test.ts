import { contractIndexToIdentity, identityToPublicKey } from "@qubic.org/crypto";
import type { SmartContractCaller } from "@qubic.org/contracts";
import { ok } from "@qubic.org/types";
import { describe, expect, test } from "bun:test";
import {
  getStarterAction,
  qearnActions,
  qearnGetStateOfRoundAction,
  qearnGetUserLockedInfoAction,
  qearnLockAction,
  qearnUnlockAction,
  qutilActions,
  qutilBurnQubicAction,
  qutilCreatePollAction,
  qutilDistributeQuToShareholdersAction,
  qutilGetBalances16Action,
  qutilQueryPriceOracleAction,
  qutilSendToManyV1Action,
  qutilSubscribePriceOracleAction,
  qutilTransferSharesManagementRightsAction,
  starterActions,
} from "./index";

const identity = contractIndexToIdentity(1);
const secondIdentity = contractIndexToIdentity(2);
const identityToPublicKeyDependency = {
  identityToPublicKey: (value: string) => identityToPublicKey(value as typeof identity),
};

function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

describe("starter action catalog", () => {
  test("exports stable QEarn and QUtil catalog entries with contract indexes and input types", () => {
    expect(qearnActions.length).toBe(10);
    expect(qutilActions.length).toBe(22);
    expect(starterActions.length).toBe(32);
    expect(getStarterAction("qearn.unlock")).toBe(qearnUnlockAction);
    expect(getStarterAction("qutil.sendToManyV1")).toBe(qutilSendToManyV1Action);
    expect(qearnUnlockAction.contractIndex).toBe(9);
    expect(qearnUnlockAction.inputType).toBe(2);
    expect(qutilSendToManyV1Action.contractIndex).toBe(4);
    expect(qutilSendToManyV1Action.inputType).toBe(1);
  });

  test("validates required fields without inventing amounts or fees", () => {
    const invalid = qearnUnlockAction.validateInput({ amount: 1, lockedEpoch: -1 });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.issues.map((issue) => issue.field)).toEqual(["amount", "lockedEpoch"]);
    }

    const valid = qearnUnlockAction.validateInput({ amount: BigInt(1), lockedEpoch: 0 });
    expect(valid).toEqual({ ok: true, value: { amount: BigInt(1), lockedEpoch: 0 } });

    const feeAction = getStarterAction("qutil.getFees");
    expect(feeAction?.availability.status).toBe("available");
    expect(feeAction?.fields).toEqual([]);
    if (feeAction?.availability.status === "available") {
      expect(feeAction.availability.evidence).toContain("queried at runtime");
    }
  });

  test("builds only confirmed QEarn and QUtil procedure payloads", () => {
    const unlockCall = qearnUnlockAction.buildCall?.({ amount: BigInt(123), lockedEpoch: 456 });
    expect(unlockCall).toEqual({
      contractIndex: 9,
      inputType: 2,
      payload: expect.any(Uint8Array),
    });
    expect(unlockCall?.payload.byteLength).toBe(12);

    const sendCall = qutilSendToManyV1Action.buildCall?.(
      { dst0: secondIdentity, amt0: BigInt(789) },
      identityToPublicKeyDependency,
    );
    expect(sendCall?.contractIndex).toBe(4);
    expect(sendCall?.inputType).toBe(1);
    expect(sendCall?.payload.byteLength).toBe(40);

    const burnCall = qutilBurnQubicAction.buildCall?.({ amount: BigInt(1000) });
    expect(burnCall?.contractIndex).toBe(4);
    expect(burnCall?.inputType).toBe(2);
    expect(burnCall?.payload.byteLength).toBe(8);
  });

  test("requires an identity converter for generated id fields", () => {
    expect(() =>
      qearnGetUserLockedInfoAction.buildInput?.({ user: identity, epoch: 12 }),
    ).toThrow("identityToPublicKey");

    const payload = qearnGetUserLockedInfoAction.buildInput?.(
      { user: identity, epoch: 12 },
      identityToPublicKeyDependency,
    );
    expect(payload?.byteLength).toBe(36);

    const balances = qutilGetBalances16Action.validateInput({
      publicKeys: Array.from({ length: 16 }, () => identity),
    });
    expect(balances.ok).toBe(true);
  });

  test("keeps QEarn lock unavailable because the public package has no lock builder", () => {
    expect(qearnLockAction.availability).toMatchObject({ status: "unavailable" });
    expect(qearnLockAction.buildCall).toBeUndefined();
    expect(qearnLockAction.availability.evidence).toContain("no buildQearnLockInput");
    expect(qearnLockAction.validateInput({})).toEqual({ ok: true, value: {} });
  });

  test("keeps CreatePoll unavailable across its conflicting public type and ABI semantics", () => {
    expect(qutilCreatePollAction.availability.status).toBe("unavailable");
    expect(qutilCreatePollAction.buildCall).toBeUndefined();
    expect(qutilCreatePollAction.fields.map((field) => field.name)).toEqual([
      "poll_name",
      "poll_type",
      "min_amount",
      "github_link",
      "allowed_assets",
      "num_assets",
    ]);
    expect(qutilCreatePollAction.fields[4]?.validation).toEqual({ kind: "asset-array", length: 16 });

    const metadataInput = {
      poll_name: identity,
      poll_type: BigInt(1),
      min_amount: BigInt(0),
      github_link: Array.from({ length: 256 }, () => 0),
      allowed_assets: Array.from({ length: 16 }, () => ({ issuer: secondIdentity, assetName: BigInt(1) })),
      num_assets: BigInt(1),
    };
    expect(qutilCreatePollAction.validateInput(metadataInput)).toEqual({ ok: true, value: metadataInput });
  });

  test("describes nested oracle fields with exact generated struct names", () => {
    const queryField = qutilQueryPriceOracleAction.fields[0];
    expect(queryField?.name).toBe("priceOracleQuery");
    expect(queryField?.fields?.map((field) => field.name)).toEqual([
      "oracle",
      "timestamp",
      "currency1",
      "currency2",
    ]);
    expect(queryField?.fields?.[1]?.fields?.map((field) => field.name)).toEqual(["value"]);
  });

  test("does not expose builders that cannot encode their identity fields safely", () => {
    for (const action of [
      qutilDistributeQuToShareholdersAction,
      qutilTransferSharesManagementRightsAction,
      qutilQueryPriceOracleAction,
      qutilSubscribePriceOracleAction,
    ]) {
      expect(action.availability.status).toBe("unavailable");
      expect(action.buildCall).toBeUndefined();
      if (action.availability.status === "unavailable") {
        expect(action.availability.reason).toContain("zero-fills");
      }
    }
  });

  test("exposes a typed query invocation that uses the generated public function", async () => {
    let receivedRequest: Parameters<SmartContractCaller["querySmartContract"]>[0] | undefined;
    const live: SmartContractCaller = {
      querySmartContract: async (request: typeof receivedRequest) => {
        receivedRequest = request;
        const response = new Uint8Array(4);
        new DataView(response.buffer).setUint32(0, 7, true);
        return ok({ responseData: bytesToBase64(response) });
      },
    };

    if (qearnGetStateOfRoundAction.query === undefined) throw new Error("query builder missing");
    const result = await qearnGetStateOfRoundAction.query(live, { epoch: 42 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.state).toBe(7);
    expect(receivedRequest).toMatchObject({ contractIndex: 9, inputType: 3, inputSize: 4 });
  });
});
