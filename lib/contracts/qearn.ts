import {
  QEARN_CONTRACT_INDEX,
  QEARN_GET_BURNED_AND_BOOSTED_STATS_INPUT_TYPE,
  QEARN_GET_BURNED_AND_BOOSTED_STATS_PER_EPOCH_INPUT_TYPE,
  QEARN_GET_LOCK_INFO_PER_EPOCH_INPUT_TYPE,
  QEARN_GET_STATE_OF_ROUND_INPUT_TYPE,
  QEARN_GET_STATS_PER_EPOCH_INPUT_TYPE,
  QEARN_GET_USER_LOCKED_INFO_INPUT_TYPE,
  QEARN_GET_USER_LOCK_STATUS_INPUT_TYPE,
  QEARN_GET_ENDED_STATUS_INPUT_TYPE,
  QEARN_LOCK_INPUT_TYPE,
  QEARN_UNLOCK_INPUT_TYPE,
  buildQearnGetBurnedAndBoostedStatsPerEpochInput,
  buildQearnGetLockInfoPerEpochInput,
  buildQearnGetStateOfRoundInput,
  buildQearnGetStatsPerEpochInput,
  buildQearnGetUserLockedInfoInput,
  buildQearnGetUserLockStatusInput,
  buildQearnGetEndedStatusInput,
  buildQearnUnlockInput,
  qearnGetBurnedAndBoostedStats,
  qearnGetBurnedAndBoostedStatsPerEpoch,
  qearnGetLockInfoPerEpoch,
  qearnGetStateOfRound,
  qearnGetStatsPerEpoch,
  qearnGetUserLockedInfo,
  qearnGetUserLockStatus,
  qearnGetEndedStatus,
} from "@qubic.org/contracts";
import type {
  ContractCall,
  QearnGetBurnedAndBoostedStatsOutput,
  QearnGetBurnedAndBoostedStatsPerEpochInput,
  QearnGetBurnedAndBoostedStatsPerEpochOutput,
  QearnGetLockInfoPerEpochInput,
  QearnGetLockInfoPerEpochOutput,
  QearnGetStateOfRoundInput,
  QearnGetStateOfRoundOutput,
  QearnGetStatsPerEpochInput,
  QearnGetStatsPerEpochOutput,
  QearnGetUserLockedInfoInput,
  QearnGetUserLockedInfoOutput,
  QearnGetUserLockStatusInput,
  QearnGetUserLockStatusOutput,
  QearnGetEndedStatusInput,
  QearnGetEndedStatusOutput,
  QearnUnlockInput,
  QearnUnlockOutput,
  SmartContractCaller,
} from "@qubic.org/contracts";
import type { QubicRpcError } from "@qubic.org/rpc";
import type { Result } from "@qubic.org/types";
import {
  assertValidActionInput,
  requireIdentityToPublicKey,
  validateActionInput,
  type ActionBuildDependencies,
  type ContractCallOptions,
  type ActionDefinition,
  type ActionField,
} from "./action-types";

export { QEARN_CONTRACT_INDEX };
export type {
  QearnGetBurnedAndBoostedStatsOutput,
  QearnGetBurnedAndBoostedStatsPerEpochInput,
  QearnGetBurnedAndBoostedStatsPerEpochOutput,
  QearnGetLockInfoPerEpochInput,
  QearnGetLockInfoPerEpochOutput,
  QearnGetStateOfRoundInput,
  QearnGetStateOfRoundOutput,
  QearnGetStatsPerEpochInput,
  QearnGetStatsPerEpochOutput,
  QearnGetUserLockedInfoInput,
  QearnGetUserLockedInfoOutput,
  QearnGetUserLockStatusInput,
  QearnGetUserLockStatusOutput,
  QearnGetEndedStatusInput,
  QearnGetEndedStatusOutput,
  QearnUnlockInput,
  QearnUnlockOutput,
};

const uint32 = (name: string): ActionField => ({
  name,
  required: true,
  valueType: "number",
  validation: { kind: "integer", bits: 32, signed: false },
});

const uint64 = (name: string): ActionField => ({
  name,
  required: true,
  valueType: "bigint",
  validation: { kind: "integer", bits: 64, signed: false },
});

const identity = (name: string): ActionField => ({
  name,
  required: true,
  valueType: "identity",
  validation: { kind: "identity" },
});

const emptyFields: readonly ActionField[] = [];

function procedure<TInput extends object>(options: {
  id: string;
  name: string;
  inputType: number;
  fields: readonly ActionField[];
  requiresIdentityToPublicKey: boolean;
  evidence: string;
  build: (input: TInput, dependencies: ActionBuildDependencies | undefined) => ContractCall;
}): ActionDefinition<TInput> {
  return {
    id: options.id,
    name: options.name,
    contractName: "QEarn",
    contractIndex: QEARN_CONTRACT_INDEX,
    inputType: options.inputType,
    kind: "procedure",
    fields: options.fields,
    availability: { status: "available", evidence: options.evidence },
    requiresIdentityToPublicKey: options.requiresIdentityToPublicKey,
    validateInput: (input) => validateActionInput<TInput>(options.fields, input),
    buildCall: (input, dependencies) => options.build(assertValidActionInput(options.fields, input), dependencies),
  };
}

function query<TInput extends object, TOutput>(options: {
  id: string;
  name: string;
  inputType: number;
  fields: readonly ActionField[];
  requiresIdentityToPublicKey: boolean;
  evidence: string;
  buildInput?: (input: TInput, dependencies: ActionBuildDependencies | undefined) => Uint8Array;
  invoke: (
    live: SmartContractCaller,
    input: TInput,
    options?: ContractCallOptions,
  ) => Promise<Result<TOutput, QubicRpcError>>;
}): ActionDefinition<TInput, TOutput> {
  return {
    id: options.id,
    name: options.name,
    contractName: "QEarn",
    contractIndex: QEARN_CONTRACT_INDEX,
    inputType: options.inputType,
    kind: "function",
    fields: options.fields,
    availability: { status: "available", evidence: options.evidence },
    requiresIdentityToPublicKey: options.requiresIdentityToPublicKey,
    validateInput: (input) => validateActionInput<TInput>(options.fields, input),
    ...(options.buildInput
      ? {
          buildInput: (input: TInput, dependencies?: ActionBuildDependencies) =>
            options.buildInput?.(assertValidActionInput(options.fields, input), dependencies) ?? new Uint8Array(),
        }
      : {}),
    query: (live, input, callOptions) =>
      options.invoke(live, assertValidActionInput(options.fields, input), callOptions),
  };
}

function unavailable<TInput extends object>(options: {
  id: string;
  name: string;
  inputType: number;
  fields: readonly ActionField[];
  reason: string;
  evidence: string;
}): ActionDefinition<TInput> {
  return {
    id: options.id,
    name: options.name,
    contractName: "QEarn",
    contractIndex: QEARN_CONTRACT_INDEX,
    inputType: options.inputType,
    kind: "procedure",
    fields: options.fields,
    availability: { status: "unavailable", reason: options.reason, evidence: options.evidence },
    requiresIdentityToPublicKey: false,
    validateInput: (input) => validateActionInput<TInput>(options.fields, input),
  };
}

export const qearnLockAction = unavailable<Record<string, never>>({
  id: "qearn.lock",
  name: "lock",
  inputType: QEARN_LOCK_INPUT_TYPE,
  fields: emptyFields,
  reason: "No typed invocation is exposed because the installed public package does not export a lock input builder.",
  evidence: "@qubic.org/contracts qearn.d.ts exports decodeQearnLockOutput but no buildQearnLockInput; no payload is fabricated.",
});

export const qearnUnlockAction = procedure<QearnUnlockInput>({
  id: "qearn.unlock",
  name: "unlock",
  inputType: QEARN_UNLOCK_INPUT_TYPE,
  fields: [uint64("amount"), uint32("lockedEpoch")],
  requiresIdentityToPublicKey: false,
  evidence: "@qubic.org/contracts exports QEARN_CONTRACT_INDEX=9, QEARN_UNLOCK_INPUT_TYPE=2, and buildQearnUnlockInput(QearnUnlockInput): ContractCall.",
  build: (input) => buildQearnUnlockInput(input),
});

export const qearnGetLockInfoPerEpochAction = query<QearnGetLockInfoPerEpochInput, QearnGetLockInfoPerEpochOutput>({
  id: "qearn.getLockInfoPerEpoch",
  name: "getLockInfoPerEpoch",
  inputType: QEARN_GET_LOCK_INFO_PER_EPOCH_INPUT_TYPE,
  fields: [uint32("Epoch")],
  requiresIdentityToPublicKey: false,
  evidence: "@qubic.org/contracts exports buildQearnGetLockInfoPerEpochInput and qearnGetLockInfoPerEpoch with matching typed input/output declarations.",
  buildInput: (input) => buildQearnGetLockInfoPerEpochInput(input),
  invoke: qearnGetLockInfoPerEpoch,
});

export const qearnGetUserLockedInfoAction = query<QearnGetUserLockedInfoInput, QearnGetUserLockedInfoOutput>({
  id: "qearn.getUserLockedInfo",
  name: "getUserLockedInfo",
  inputType: QEARN_GET_USER_LOCKED_INFO_INPUT_TYPE,
  fields: [identity("user"), uint32("epoch")],
  requiresIdentityToPublicKey: true,
  evidence: "@qubic.org/contracts exports buildQearnGetUserLockedInfoInput(identityToPublicKey) and qearnGetUserLockedInfo with matching typed input/output declarations.",
  buildInput: (input, dependencies) =>
    buildQearnGetUserLockedInfoInput(input, requireIdentityToPublicKey(dependencies)),
  invoke: qearnGetUserLockedInfo,
});

export const qearnGetStateOfRoundAction = query<QearnGetStateOfRoundInput, QearnGetStateOfRoundOutput>({
  id: "qearn.getStateOfRound",
  name: "getStateOfRound",
  inputType: QEARN_GET_STATE_OF_ROUND_INPUT_TYPE,
  fields: [uint32("epoch")],
  requiresIdentityToPublicKey: false,
  evidence: "@qubic.org/contracts exports buildQearnGetStateOfRoundInput and qearnGetStateOfRound with matching typed input/output declarations.",
  buildInput: (input) => buildQearnGetStateOfRoundInput(input),
  invoke: qearnGetStateOfRound,
});

export const qearnGetUserLockStatusAction = query<QearnGetUserLockStatusInput, QearnGetUserLockStatusOutput>({
  id: "qearn.getUserLockStatus",
  name: "getUserLockStatus",
  inputType: QEARN_GET_USER_LOCK_STATUS_INPUT_TYPE,
  fields: [identity("user")],
  requiresIdentityToPublicKey: true,
  evidence: "@qubic.org/contracts exports buildQearnGetUserLockStatusInput(identityToPublicKey) and qearnGetUserLockStatus with matching typed input/output declarations.",
  buildInput: (input, dependencies) =>
    buildQearnGetUserLockStatusInput(input, requireIdentityToPublicKey(dependencies)),
  invoke: qearnGetUserLockStatus,
});

export const qearnGetEndedStatusAction = query<QearnGetEndedStatusInput, QearnGetEndedStatusOutput>({
  id: "qearn.getEndedStatus",
  name: "getEndedStatus",
  inputType: QEARN_GET_ENDED_STATUS_INPUT_TYPE,
  fields: [identity("user")],
  requiresIdentityToPublicKey: true,
  evidence: "@qubic.org/contracts exports buildQearnGetEndedStatusInput(identityToPublicKey) and qearnGetEndedStatus with matching typed input/output declarations.",
  buildInput: (input, dependencies) =>
    buildQearnGetEndedStatusInput(input, requireIdentityToPublicKey(dependencies)),
  invoke: qearnGetEndedStatus,
});

export const qearnGetStatsPerEpochAction = query<QearnGetStatsPerEpochInput, QearnGetStatsPerEpochOutput>({
  id: "qearn.getStatsPerEpoch",
  name: "getStatsPerEpoch",
  inputType: QEARN_GET_STATS_PER_EPOCH_INPUT_TYPE,
  fields: [uint32("epoch")],
  requiresIdentityToPublicKey: false,
  evidence: "@qubic.org/contracts exports buildQearnGetStatsPerEpochInput and qearnGetStatsPerEpoch with matching typed input/output declarations.",
  buildInput: (input) => buildQearnGetStatsPerEpochInput(input),
  invoke: qearnGetStatsPerEpoch,
});

export const qearnGetBurnedAndBoostedStatsAction = query<Record<string, never>, QearnGetBurnedAndBoostedStatsOutput>({
  id: "qearn.getBurnedAndBoostedStats",
  name: "getBurnedAndBoostedStats",
  inputType: QEARN_GET_BURNED_AND_BOOSTED_STATS_INPUT_TYPE,
  fields: emptyFields,
  requiresIdentityToPublicKey: false,
  evidence: "@qubic.org/contracts exports qearnGetBurnedAndBoostedStats(live, options?) for inputType=7 with no input fields.",
  invoke: (live, _input, options) => qearnGetBurnedAndBoostedStats(live, options),
});

export const qearnGetBurnedAndBoostedStatsPerEpochAction = query<
  QearnGetBurnedAndBoostedStatsPerEpochInput,
  QearnGetBurnedAndBoostedStatsPerEpochOutput
>({
  id: "qearn.getBurnedAndBoostedStatsPerEpoch",
  name: "getBurnedAndBoostedStatsPerEpoch",
  inputType: QEARN_GET_BURNED_AND_BOOSTED_STATS_PER_EPOCH_INPUT_TYPE,
  fields: [uint32("epoch")],
  requiresIdentityToPublicKey: false,
  evidence: "@qubic.org/contracts exports buildQearnGetBurnedAndBoostedStatsPerEpochInput and qearnGetBurnedAndBoostedStatsPerEpoch with matching typed input/output declarations.",
  buildInput: (input) => buildQearnGetBurnedAndBoostedStatsPerEpochInput(input),
  invoke: qearnGetBurnedAndBoostedStatsPerEpoch,
});

export const qearnActions = [
  qearnLockAction,
  qearnUnlockAction,
  qearnGetLockInfoPerEpochAction,
  qearnGetUserLockedInfoAction,
  qearnGetStateOfRoundAction,
  qearnGetUserLockStatusAction,
  qearnGetEndedStatusAction,
  qearnGetStatsPerEpochAction,
  qearnGetBurnedAndBoostedStatsAction,
  qearnGetBurnedAndBoostedStatsPerEpochAction,
] as const;
