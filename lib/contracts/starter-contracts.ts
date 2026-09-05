import { identityToPublicKey, type Identity } from "@qubic.org/crypto";
import * as contracts from "@qubic.org/contracts";
import type { SmartContractCaller } from "@qubic.org/contracts";

type ContractReadResult = {
  ok: boolean;
  value?: unknown;
  error?: unknown;
};

export type StarterContractId = "qearn" | "q-util";
export type StarterActionId =
  "qearn-stats" | "qearn-lock" | "q-util-fees" | "q-util-vote";

type ContractQueryAction = {
  id: StarterActionId;
  contractId: StarterContractId;
  kind: "query";
  label: string;
  description: string;
  run: (live: SmartContractCaller) => Promise<ContractReadResult>;
};

type ContractProcedureAction = {
  id: StarterActionId;
  contractId: StarterContractId;
  kind: "procedure";
  label: string;
  description: string;
  fields: readonly ProcedureField[];
};

export type StarterContractAction =
  ContractQueryAction | ContractProcedureAction;

export type ProcedureField = {
  id: string;
  label: string;
  placeholder: string;
  inputMode: "numeric";
  help?: string;
};

export type PreparedContractProcedure = {
  label: string;
  contractIndex: number;
  inputType: number;
  payload?: Uint8Array;
  amount: string;
};

export const STARTER_CONTRACTS = [
  {
    id: "qearn",
    label: "QEarn",
    description: "Read protocol stats or prepare a lock request.",
  },
  {
    id: "q-util",
    label: "QUtil",
    description: "Read protocol fees or prepare a poll vote.",
  },
] as const satisfies readonly {
  id: StarterContractId;
  label: string;
  description: string;
}[];

export const STARTER_CONTRACT_ACTIONS: readonly StarterContractAction[] = [
  {
    id: "qearn-stats",
    contractId: "qearn",
    kind: "query",
    label: "Protocol stats",
    description: "Read QEarn burned and boosted statistics.",
    run: (live) => contracts.qearn.getBurnedAndBoostedStats(live),
  },
  {
    id: "qearn-lock",
    contractId: "qearn",
    kind: "procedure",
    label: "Lock QU",
    description:
      "Attach QU to the QEarn lock procedure. Your wallet shows the final request.",
    fields: [
      {
        id: "amount",
        label: "Amount (QU)",
        placeholder: "1000000",
        inputMode: "numeric",
        help: "Whole QU only. This amount is attached to the contract call.",
      },
    ],
  },
  {
    id: "q-util-fees",
    contractId: "q-util",
    kind: "query",
    label: "Protocol fees",
    description: "Read the current QUtil fee configuration.",
    run: (live) => contracts.qUtil.GetFees(live),
  },
  {
    id: "q-util-vote",
    contractId: "q-util",
    kind: "procedure",
    label: "Vote in a poll",
    description:
      "Build a QUtil vote for your connected identity. No QU is attached to this call.",
    fields: [
      {
        id: "pollId",
        label: "Poll ID",
        placeholder: "1",
        inputMode: "numeric",
      },
      {
        id: "option",
        label: "Option",
        placeholder: "0",
        inputMode: "numeric",
      },
      {
        id: "amount",
        label: "Vote amount",
        placeholder: "0",
        inputMode: "numeric",
        help: "Passed to the QUtil vote procedure, not attached as QU.",
      },
    ],
  },
];

function parseWholeNumber(
  value: string,
  label: string,
  { minimum = BigInt(0) }: { minimum?: bigint } = {},
) {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error(`${label} must be a whole number.`);
  }
  const parsed = BigInt(normalized);
  if (parsed < minimum) {
    throw new Error(`${label} must be at least ${minimum.toString()}.`);
  }
  return parsed;
}

function toSafeUInt64(value: string, label: string, minimum = BigInt(0)) {
  const parsed = parseWholeNumber(value, label, { minimum });
  const uint64Max = BigInt("18446744073709551615");
  if (parsed > uint64Max) {
    throw new Error(`${label} is too large.`);
  }
  return parsed;
}

export function starterContractActionsFor(contractId: StarterContractId) {
  return STARTER_CONTRACT_ACTIONS.filter(
    (action) => action.contractId === contractId,
  );
}

export function starterContractAction(id: string) {
  return STARTER_CONTRACT_ACTIONS.find((action) => action.id === id);
}

/**
 * Builds only the two reviewed starter procedures with generated package helpers.
 * The app never accepts a raw contract index, input type, or payload from users.
 */
export function prepareStarterContractProcedure(
  actionId: StarterActionId,
  values: Record<string, string>,
  identity: string,
): PreparedContractProcedure {
  if (actionId === "qearn-lock") {
    const amount = toSafeUInt64(values.amount ?? "", "Amount", BigInt(1));
    return {
      label: "Lock QU",
      contractIndex: contracts.qearn.contractIndex,
      inputType: contracts.QEARN_LOCK_INPUT_TYPE,
      amount: amount.toString(),
    };
  }

  if (actionId === "q-util-vote") {
    const pollId = toSafeUInt64(values.pollId ?? "", "Poll ID", BigInt(1));
    const option = toSafeUInt64(values.option ?? "", "Option");
    const amount = toSafeUInt64(values.amount ?? "", "Vote amount");
    const call = contracts.qUtil.buildVoteInput(
      {
        poll_id: pollId,
        address: identity,
        amount,
        chosen_option: option,
      },
      (value) => identityToPublicKey(value as Identity),
    );
    return {
      label: "Vote in a poll",
      contractIndex: call.contractIndex,
      inputType: call.inputType,
      payload: call.payload,
      amount: "0",
    };
  }

  throw new Error("Choose a procedure before submitting.");
}

export function stringifyContractResult(value: unknown) {
  return JSON.stringify(
    value,
    (_key, item) => (typeof item === "bigint" ? item.toString() : item),
    2,
  );
}

export function payloadToBase64(payload: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < payload.length; index += chunkSize) {
    binary += String.fromCharCode(
      ...payload.subarray(index, index + chunkSize),
    );
  }
  return btoa(binary);
}
