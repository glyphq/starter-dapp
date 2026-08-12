import {
  Q_UTIL_BURN_QUBIC_FOR_CONTRACT_INPUT_TYPE,
  Q_UTIL_BURN_QUBIC_INPUT_TYPE,
  Q_UTIL_CANCEL_POLL_INPUT_TYPE,
  Q_UTIL_CREATE_POLL_INPUT_TYPE,
  Q_UTIL_DISTRIBUTE_QU_TO_SHAREHOLDERS_INPUT_TYPE,
  Q_UTIL_GET_BALANCES16_INPUT_TYPE,
  Q_UTIL_GET_CURRENT_POLL_ID_INPUT_TYPE,
  Q_UTIL_GET_CURRENT_RESULT_INPUT_TYPE,
  Q_UTIL_GET_FEES_INPUT_TYPE,
  Q_UTIL_GET_POLLS_BY_CREATOR_INPUT_TYPE,
  Q_UTIL_GET_POLL_INFO_INPUT_TYPE,
  Q_UTIL_GET_SEND_TO_MANY_V1FEE_INPUT_TYPE,
  Q_UTIL_GET_TOTAL_NUMBER_OF_ASSET_SHARES_INPUT_TYPE,
  Q_UTIL_QUERY_FEE_RESERVE_INPUT_TYPE,
  Q_UTIL_QUERY_PRICE_ORACLE_INPUT_TYPE,
  Q_UTIL_SEND_TO_MANY_BENCHMARK_INPUT_TYPE,
  Q_UTIL_SEND_TO_MANY_V1_INPUT_TYPE,
  Q_UTIL_SUBSCRIBE_PRICE_ORACLE_INPUT_TYPE,
  Q_UTIL_TRANSFER_SHARES_MANAGEMENT_RIGHTS_INPUT_TYPE,
  Q_UTIL_TRANSFER_SHARES_TO_MANY_V1_INPUT_TYPE,
  Q_UTIL_UNSUBSCRIBE_ORACLE_INPUT_TYPE,
  Q_UTIL_VOTE_INPUT_TYPE,
  Q_UTIL_CONTRACT_INDEX,
  buildQUtilBurnQubicForContractInput,
  buildQUtilBurnQubicInput,
  buildQUtilCancelPollInput,
  buildQUtilGetBalances16Input,
  buildQUtilGetCurrentResultInput,
  buildQUtilGetPollsByCreatorInput,
  buildQUtilGetPollInfoInput,
  buildQUtilGetTotalNumberOfAssetSharesInput,
  buildQUtilQueryFeeReserveInput,
  buildQUtilSendToManyBenchmarkInput,
  buildQUtilSendToManyV1Input,
  buildQUtilTransferSharesToManyV1Input,
  buildQUtilUnsubscribeOracleInput,
  buildQUtilVoteInput,
  qUtilGetBalances16,
  qUtilGetCurrentPollId,
  qUtilGetCurrentResult,
  qUtilGetFees,
  qUtilGetPollsByCreator,
  qUtilGetPollInfo,
  qUtilGetSendToManyV1Fee,
  qUtilGetTotalNumberOfAssetShares,
  qUtilQueryFeeReserve,
} from "@qubic.org/contracts";
import type {
  ContractCall,
  QUtilAssetStruct,
  QUtilBurnQubicForContractInput,
  QUtilBurnQubicForContractOutput,
  QUtilBurnQubicInput,
  QUtilBurnQubicOutput,
  QUtilCancelPollInput,
  QUtilCancelPollOutput,
  QUtilCreatePollInput,
  QUtilCreatePollOutput,
  QUtilDistributeQuToShareholdersInput,
  QUtilDistributeQuToShareholdersOutput,
  QUtilGetBalances16Input,
  QUtilGetBalances16Output,
  QUtilGetCurrentPollIdOutput,
  QUtilGetCurrentResultInput,
  QUtilGetCurrentResultOutput,
  QUtilGetFeesOutput,
  QUtilGetPollInfoInput,
  QUtilGetPollInfoOutput,
  QUtilGetPollsByCreatorInput,
  QUtilGetPollsByCreatorOutput,
  QUtilGetSendToManyV1FeeOutput,
  QUtilGetTotalNumberOfAssetSharesInput,
  QUtilGetTotalNumberOfAssetSharesOutput,
  QUtilQueryFeeReserveInput,
  QUtilQueryFeeReserveOutput,
  QUtilQueryPriceOracleInput,
  QUtilQueryPriceOracleOutput,
  QUtilSendToManyBenchmarkInput,
  QUtilSendToManyBenchmarkOutput,
  QUtilSendToManyV1Input,
  QUtilSendToManyV1Output,
  QUtilSubscribePriceOracleInput,
  QUtilSubscribePriceOracleOutput,
  QUtilTransferSharesManagementRightsInput,
  QUtilTransferSharesManagementRightsOutput,
  QUtilTransferSharesToManyV1Input,
  QUtilTransferSharesToManyV1Output,
  QUtilUnsubscribeOracleInput,
  QUtilUnsubscribeOracleOutput,
  QUtilVoteInput,
  QUtilVoteOutput,
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

export { Q_UTIL_CONTRACT_INDEX };
export type { QUtilAssetStruct };
export type {
  QUtilBurnQubicForContractInput,
  QUtilBurnQubicForContractOutput,
  QUtilBurnQubicInput,
  QUtilBurnQubicOutput,
  QUtilCancelPollInput,
  QUtilCancelPollOutput,
  QUtilCreatePollInput,
  QUtilCreatePollOutput,
  QUtilDistributeQuToShareholdersInput,
  QUtilDistributeQuToShareholdersOutput,
  QUtilGetBalances16Input,
  QUtilGetBalances16Output,
  QUtilGetCurrentPollIdOutput,
  QUtilGetCurrentResultInput,
  QUtilGetCurrentResultOutput,
  QUtilGetFeesOutput,
  QUtilGetPollInfoInput,
  QUtilGetPollInfoOutput,
  QUtilGetPollsByCreatorInput,
  QUtilGetPollsByCreatorOutput,
  QUtilGetSendToManyV1FeeOutput,
  QUtilGetTotalNumberOfAssetSharesInput,
  QUtilGetTotalNumberOfAssetSharesOutput,
  QUtilQueryFeeReserveInput,
  QUtilQueryFeeReserveOutput,
  QUtilQueryPriceOracleInput,
  QUtilQueryPriceOracleOutput,
  QUtilSendToManyBenchmarkInput,
  QUtilSendToManyBenchmarkOutput,
  QUtilSendToManyV1Input,
  QUtilSendToManyV1Output,
  QUtilSubscribePriceOracleInput,
  QUtilSubscribePriceOracleOutput,
  QUtilTransferSharesManagementRightsInput,
  QUtilTransferSharesManagementRightsOutput,
  QUtilTransferSharesToManyV1Input,
  QUtilTransferSharesToManyV1Output,
  QUtilUnsubscribeOracleInput,
  QUtilUnsubscribeOracleOutput,
  QUtilVoteInput,
  QUtilVoteOutput,
};

/**
 * ABI-shaped CreatePoll input from the installed registry. The generated
 * package declaration currently types `allowed_assets` as `number[]`, while
 * its generated payload fields require sixteen Asset structs. It is therefore
 * exposed for metadata only and is not invokable through this starter catalog.
 */
export interface QUtilCreatePollActionInput {
  poll_name: string;
  poll_type: bigint;
  min_amount: bigint;
  github_link: number[];
  allowed_assets: QUtilAssetStruct[];
  num_assets: bigint;
}

const uint8 = (name: string): ActionField => ({
  name,
  required: true,
  valueType: "number",
  validation: { kind: "integer", bits: 8, signed: false },
});

const uint32 = (name: string): ActionField => ({
  name,
  required: true,
  valueType: "number",
  validation: { kind: "integer", bits: 32, signed: false },
});

const sint32 = (name: string): ActionField => ({
  name,
  required: true,
  valueType: "number",
  validation: { kind: "integer", bits: 32, signed: true },
});

const uint64 = (name: string): ActionField => ({
  name,
  required: true,
  valueType: "bigint",
  validation: { kind: "integer", bits: 64, signed: false },
});

const sint64 = (name: string): ActionField => ({
  name,
  required: true,
  valueType: "bigint",
  validation: { kind: "integer", bits: 64, signed: true },
});

const identity = (name: string): ActionField => ({
  name,
  required: true,
  valueType: "identity",
  validation: { kind: "identity" },
});

const bytes = (name: string, length: number): ActionField => ({
  name,
  required: true,
  valueType: "byte-array",
  validation: { kind: "byte-array", length },
});

const assetFields: readonly ActionField[] = [identity("issuer"), uint64("assetName")];
const asset = (name: string): ActionField => ({
  name,
  required: true,
  valueType: "asset",
  validation: { kind: "asset" },
  fields: assetFields,
});
const assetArray = (name: string, length: number): ActionField => ({
  name,
  required: true,
  valueType: "asset-array",
  validation: { kind: "asset-array", length },
  fields: assetFields,
});
const dateAndTime: ActionField = {
  name: "timestamp",
  required: true,
  valueType: "struct",
  validation: { kind: "struct" },
  fields: [uint64("value")],
};
const priceOracleQueryFields: readonly ActionField[] = [
  identity("oracle"),
  dateAndTime,
  identity("currency1"),
  identity("currency2"),
];
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
    contractName: "QUtil",
    contractIndex: Q_UTIL_CONTRACT_INDEX,
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
    contractName: "QUtil",
    contractIndex: Q_UTIL_CONTRACT_INDEX,
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
    contractName: "QUtil",
    contractIndex: Q_UTIL_CONTRACT_INDEX,
    inputType: options.inputType,
    kind: "procedure",
    fields: options.fields,
    availability: { status: "unavailable", reason: options.reason, evidence: options.evidence },
    requiresIdentityToPublicKey: true,
    validateInput: (input) => validateActionInput<TInput>(options.fields, input),
  };
}

export const qutilSendToManyV1Action = procedure<QUtilSendToManyV1Input>({
  id: "qutil.sendToManyV1",
  name: "SendToManyV1",
  inputType: Q_UTIL_SEND_TO_MANY_V1_INPUT_TYPE,
  fields: [identity("dst0"), sint64("amt0")],
  requiresIdentityToPublicKey: true,
  evidence: "@qubic.org/contracts exports Q_UTIL_CONTRACT_INDEX=4, Q_UTIL_SEND_TO_MANY_V1_INPUT_TYPE=1, and buildQUtilSendToManyV1Input(identityToPublicKey): ContractCall.",
  build: (input, dependencies) =>
    buildQUtilSendToManyV1Input(input, requireIdentityToPublicKey(dependencies)),
});

export const qutilBurnQubicAction = procedure<QUtilBurnQubicInput>({
  id: "qutil.burnQubic",
  name: "BurnQubic",
  inputType: Q_UTIL_BURN_QUBIC_INPUT_TYPE,
  fields: [sint64("amount")],
  requiresIdentityToPublicKey: false,
  evidence: "@qubic.org/contracts exports buildQUtilBurnQubicInput(QUtilBurnQubicInput): ContractCall with inputType=2.",
  build: (input) => buildQUtilBurnQubicInput(input),
});

export const qutilSendToManyBenchmarkAction = procedure<QUtilSendToManyBenchmarkInput>({
  id: "qutil.sendToManyBenchmark",
  name: "SendToManyBenchmark",
  inputType: Q_UTIL_SEND_TO_MANY_BENCHMARK_INPUT_TYPE,
  fields: [sint64("dstCount"), sint64("numTransfersEach")],
  requiresIdentityToPublicKey: false,
  evidence: "@qubic.org/contracts exports buildQUtilSendToManyBenchmarkInput(QUtilSendToManyBenchmarkInput): ContractCall with inputType=3.",
  build: (input) => buildQUtilSendToManyBenchmarkInput(input),
});

export const qutilCreatePollAction = unavailable<QUtilCreatePollActionInput>({
  id: "qutil.createPoll",
  name: "CreatePoll",
  inputType: Q_UTIL_CREATE_POLL_INPUT_TYPE,
  fields: [
    identity("poll_name"),
    uint64("poll_type"),
    uint64("min_amount"),
    bytes("github_link", 256),
    assetArray("allowed_assets", 16),
    uint64("num_assets"),
  ],
  reason: "Unavailable until the generated public input type and generated payload semantics agree for allowed_assets.",
  evidence: "@qubic.org/contracts qutil.d.ts types allowed_assets as number[], while the generated source and @qubic.org/registry ABI describe a 16-item array of Asset structs. No payload is fabricated across that public API conflict.",
});

export const qutilVoteAction = procedure<QUtilVoteInput>({
  id: "qutil.vote",
  name: "Vote",
  inputType: Q_UTIL_VOTE_INPUT_TYPE,
  fields: [uint64("poll_id"), identity("address"), uint64("amount"), uint64("chosen_option")],
  requiresIdentityToPublicKey: true,
  evidence: "@qubic.org/contracts exports buildQUtilVoteInput(identityToPublicKey): ContractCall with inputType=5.",
  build: (input, dependencies) => buildQUtilVoteInput(input, requireIdentityToPublicKey(dependencies)),
});

export const qutilCancelPollAction = procedure<QUtilCancelPollInput>({
  id: "qutil.cancelPoll",
  name: "CancelPoll",
  inputType: Q_UTIL_CANCEL_POLL_INPUT_TYPE,
  fields: [uint64("poll_id")],
  requiresIdentityToPublicKey: false,
  evidence: "@qubic.org/contracts exports buildQUtilCancelPollInput(QUtilCancelPollInput): ContractCall with inputType=6.",
  build: (input) => buildQUtilCancelPollInput(input),
});

export const qutilDistributeQuToShareholdersAction = unavailable<QUtilDistributeQuToShareholdersInput>({
  id: "qutil.distributeQuToShareholders",
  name: "DistributeQuToShareholders",
  inputType: Q_UTIL_DISTRIBUTE_QU_TO_SHAREHOLDERS_INPUT_TYPE,
  fields: [asset("asset")],
  reason: "Unavailable because the generated public builder accepts an Asset issuer identity but exposes no identityToPublicKey converter and zero-fills that id field.",
  evidence: "@qubic.org/contracts qutil.d.ts exports buildQUtilDistributeQuToShareholdersInput(input), while generated source passes a zero-byte identity converter for the Asset issuer field. No silently incorrect payload is exposed.",
});

export const qutilBurnQubicForContractAction = procedure<QUtilBurnQubicForContractInput>({
  id: "qutil.burnQubicForContract",
  name: "BurnQubicForContract",
  inputType: Q_UTIL_BURN_QUBIC_FOR_CONTRACT_INPUT_TYPE,
  fields: [uint32("contractIndexBurnedFor")],
  requiresIdentityToPublicKey: false,
  evidence: "@qubic.org/contracts exports buildQUtilBurnQubicForContractInput(QUtilBurnQubicForContractInput): ContractCall with inputType=8.",
  build: (input) => buildQUtilBurnQubicForContractInput(input),
});

export const qutilTransferSharesToManyV1Action = procedure<QUtilTransferSharesToManyV1Input>({
  id: "qutil.transferSharesToManyV1",
  name: "TransferSharesToManyV1",
  inputType: Q_UTIL_TRANSFER_SHARES_TO_MANY_V1_INPUT_TYPE,
  fields: [identity("issuer"), uint64("assetName"), identity("dst0"), sint64("amt0")],
  requiresIdentityToPublicKey: true,
  evidence: "@qubic.org/contracts exports buildQUtilTransferSharesToManyV1Input(identityToPublicKey): ContractCall with inputType=9.",
  build: (input, dependencies) =>
    buildQUtilTransferSharesToManyV1Input(input, requireIdentityToPublicKey(dependencies)),
});

export const qutilTransferSharesManagementRightsAction = unavailable<QUtilTransferSharesManagementRightsInput>({
  id: "qutil.transferSharesManagementRights",
  name: "TransferSharesManagementRights",
  inputType: Q_UTIL_TRANSFER_SHARES_MANAGEMENT_RIGHTS_INPUT_TYPE,
  fields: [asset("asset"), sint64("numberOfShares"), uint32("newManagingContractIndex")],
  reason: "Unavailable because the generated public builder accepts an Asset issuer identity but exposes no identityToPublicKey converter and zero-fills that id field.",
  evidence: "@qubic.org/contracts qutil.d.ts exports buildQUtilTransferSharesManagementRightsInput(input), while generated source passes a zero-byte identity converter for the Asset issuer field. No silently incorrect payload is exposed.",
});

export const qutilQueryPriceOracleAction = unavailable<QUtilQueryPriceOracleInput>({
  id: "qutil.queryPriceOracle",
  name: "QueryPriceOracle",
  inputType: Q_UTIL_QUERY_PRICE_ORACLE_INPUT_TYPE,
  fields: [
    {
      name: "priceOracleQuery",
      required: true,
      valueType: "struct",
      validation: { kind: "struct" },
      fields: priceOracleQueryFields,
    },
    uint32("timeoutMilliseconds"),
  ],
  reason: "Unavailable because the generated public builder accepts oracle and currency identities but exposes no identityToPublicKey converter and zero-fills those id fields.",
  evidence: "@qubic.org/contracts qutil.d.ts exports buildQUtilQueryPriceOracleInput(input), while generated source passes a zero-byte identity converter for the nested OracleQuery id fields. No silently incorrect payload is exposed.",
});

export const qutilSubscribePriceOracleAction = unavailable<QUtilSubscribePriceOracleInput>({
  id: "qutil.subscribePriceOracle",
  name: "SubscribePriceOracle",
  inputType: Q_UTIL_SUBSCRIBE_PRICE_ORACLE_INPUT_TYPE,
  fields: [
    {
      name: "priceOracleQuery",
      required: true,
      valueType: "struct",
      validation: { kind: "struct" },
      fields: priceOracleQueryFields,
    },
    uint32("subscriptionPeriodMilliseconds"),
    uint8("notifyPreviousValue"),
  ],
  reason: "Unavailable because the generated public builder accepts oracle and currency identities but exposes no identityToPublicKey converter and zero-fills those id fields.",
  evidence: "@qubic.org/contracts qutil.d.ts exports buildQUtilSubscribePriceOracleInput(input), while generated source passes a zero-byte identity converter for the nested OracleQuery id fields. No silently incorrect payload is exposed.",
});

export const qutilUnsubscribeOracleAction = procedure<QUtilUnsubscribeOracleInput>({
  id: "qutil.unsubscribeOracle",
  name: "UnsubscribeOracle",
  inputType: Q_UTIL_UNSUBSCRIBE_ORACLE_INPUT_TYPE,
  fields: [sint32("subscriptionId")],
  requiresIdentityToPublicKey: false,
  evidence: "@qubic.org/contracts exports buildQUtilUnsubscribeOracleInput(QUtilUnsubscribeOracleInput): ContractCall with inputType=102.",
  build: (input) => buildQUtilUnsubscribeOracleInput(input),
});

export const qutilGetSendToManyV1FeeAction = query<Record<string, never>, QUtilGetSendToManyV1FeeOutput>({
  id: "qutil.getSendToManyV1Fee",
  name: "GetSendToManyV1Fee",
  inputType: Q_UTIL_GET_SEND_TO_MANY_V1FEE_INPUT_TYPE,
  fields: emptyFields,
  requiresIdentityToPublicKey: false,
  evidence: "@qubic.org/contracts exports qUtilGetSendToManyV1Fee(live, options?) with no input fields.",
  invoke: (live, _input, options) => qUtilGetSendToManyV1Fee(live, options),
});

export const qutilGetTotalNumberOfAssetSharesAction = query<QUtilGetTotalNumberOfAssetSharesInput, QUtilGetTotalNumberOfAssetSharesOutput>({
  id: "qutil.getTotalNumberOfAssetShares",
  name: "GetTotalNumberOfAssetShares",
  inputType: Q_UTIL_GET_TOTAL_NUMBER_OF_ASSET_SHARES_INPUT_TYPE,
  fields: [identity("issuer"), uint64("assetName")],
  requiresIdentityToPublicKey: true,
  evidence: "@qubic.org/contracts exports buildQUtilGetTotalNumberOfAssetSharesInput(identityToPublicKey) and qUtilGetTotalNumberOfAssetShares with matching typed declarations.",
  buildInput: (input, dependencies) =>
    buildQUtilGetTotalNumberOfAssetSharesInput(input, requireIdentityToPublicKey(dependencies)),
  invoke: qUtilGetTotalNumberOfAssetShares,
});

export const qutilGetCurrentResultAction = query<QUtilGetCurrentResultInput, QUtilGetCurrentResultOutput>({
  id: "qutil.getCurrentResult",
  name: "GetCurrentResult",
  inputType: Q_UTIL_GET_CURRENT_RESULT_INPUT_TYPE,
  fields: [uint64("poll_id")],
  requiresIdentityToPublicKey: false,
  evidence: "@qubic.org/contracts exports buildQUtilGetCurrentResultInput and qUtilGetCurrentResult with matching typed declarations.",
  buildInput: (input) => buildQUtilGetCurrentResultInput(input),
  invoke: qUtilGetCurrentResult,
});

export const qutilGetPollsByCreatorAction = query<QUtilGetPollsByCreatorInput, QUtilGetPollsByCreatorOutput>({
  id: "qutil.getPollsByCreator",
  name: "GetPollsByCreator",
  inputType: Q_UTIL_GET_POLLS_BY_CREATOR_INPUT_TYPE,
  fields: [identity("creator")],
  requiresIdentityToPublicKey: true,
  evidence: "@qubic.org/contracts exports buildQUtilGetPollsByCreatorInput(identityToPublicKey) and qUtilGetPollsByCreator with matching typed declarations.",
  buildInput: (input, dependencies) =>
    buildQUtilGetPollsByCreatorInput(input, requireIdentityToPublicKey(dependencies)),
  invoke: qUtilGetPollsByCreator,
});

export const qutilGetCurrentPollIdAction = query<Record<string, never>, QUtilGetCurrentPollIdOutput>({
  id: "qutil.getCurrentPollId",
  name: "GetCurrentPollId",
  inputType: Q_UTIL_GET_CURRENT_POLL_ID_INPUT_TYPE,
  fields: emptyFields,
  requiresIdentityToPublicKey: false,
  evidence: "@qubic.org/contracts exports qUtilGetCurrentPollId(live, options?) with no input fields.",
  invoke: (live, _input, options) => qUtilGetCurrentPollId(live, options),
});

export const qutilGetPollInfoAction = query<QUtilGetPollInfoInput, QUtilGetPollInfoOutput>({
  id: "qutil.getPollInfo",
  name: "GetPollInfo",
  inputType: Q_UTIL_GET_POLL_INFO_INPUT_TYPE,
  fields: [uint64("poll_id")],
  requiresIdentityToPublicKey: false,
  evidence: "@qubic.org/contracts exports buildQUtilGetPollInfoInput and qUtilGetPollInfo with matching typed declarations.",
  buildInput: (input) => buildQUtilGetPollInfoInput(input),
  invoke: qUtilGetPollInfo,
});

export const qutilGetFeesAction = query<Record<string, never>, QUtilGetFeesOutput>({
  id: "qutil.getFees",
  name: "GetFees",
  inputType: Q_UTIL_GET_FEES_INPUT_TYPE,
  fields: emptyFields,
  requiresIdentityToPublicKey: false,
  evidence: "@qubic.org/contracts exports qUtilGetFees(live, options?) with no input fields. Returned fee values are queried at runtime and no amount is assumed here.",
  invoke: (live, _input, options) => qUtilGetFees(live, options),
});

export const qutilQueryFeeReserveAction = query<QUtilQueryFeeReserveInput, QUtilQueryFeeReserveOutput>({
  id: "qutil.queryFeeReserve",
  name: "QueryFeeReserve",
  inputType: Q_UTIL_QUERY_FEE_RESERVE_INPUT_TYPE,
  fields: [uint32("contractIndex")],
  requiresIdentityToPublicKey: false,
  evidence: "@qubic.org/contracts exports buildQUtilQueryFeeReserveInput and qUtilQueryFeeReserve with matching typed declarations.",
  buildInput: (input) => buildQUtilQueryFeeReserveInput(input),
  invoke: qUtilQueryFeeReserve,
});

export const qutilGetBalances16Action = query<QUtilGetBalances16Input, QUtilGetBalances16Output>({
  id: "qutil.getBalances16",
  name: "GetBalances16",
  inputType: Q_UTIL_GET_BALANCES16_INPUT_TYPE,
  fields: [
    {
      name: "publicKeys",
      required: true,
      valueType: "identity-array",
      validation: { kind: "identity-array", length: 16 },
    },
  ],
  requiresIdentityToPublicKey: true,
  evidence: "@qubic.org/contracts exports buildQUtilGetBalances16Input(identityToPublicKey) and qUtilGetBalances16; the generated input is named publicKeys but encodes id fields through the supplied identity converter.",
  buildInput: (input, dependencies) =>
    buildQUtilGetBalances16Input(input, requireIdentityToPublicKey(dependencies)),
  invoke: qUtilGetBalances16,
});

export const qutilActions = [
  qutilSendToManyV1Action,
  qutilBurnQubicAction,
  qutilSendToManyBenchmarkAction,
  qutilCreatePollAction,
  qutilVoteAction,
  qutilCancelPollAction,
  qutilDistributeQuToShareholdersAction,
  qutilBurnQubicForContractAction,
  qutilTransferSharesToManyV1Action,
  qutilTransferSharesManagementRightsAction,
  qutilQueryPriceOracleAction,
  qutilSubscribePriceOracleAction,
  qutilUnsubscribeOracleAction,
  qutilGetSendToManyV1FeeAction,
  qutilGetTotalNumberOfAssetSharesAction,
  qutilGetCurrentResultAction,
  qutilGetPollsByCreatorAction,
  qutilGetCurrentPollIdAction,
  qutilGetPollInfoAction,
  qutilGetFeesAction,
  qutilQueryFeeReserveAction,
  qutilGetBalances16Action,
] as const;
