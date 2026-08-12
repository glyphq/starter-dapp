import { isValidIdentityChecksum } from "@qubic.org/crypto";
import type { ContractCall, SmartContractCaller } from "@qubic.org/contracts";
import type { QubicRpcError } from "@qubic.org/rpc";
import type { Result } from "@qubic.org/types";

export type IdentityToPublicKey = (identity: string) => Uint8Array;

export interface ContractCallOptions {
  readonly identityToPublicKey?: IdentityToPublicKey;
  readonly publicKeyToIdentity?: (publicKey: Uint8Array) => string;
}

export interface ActionBuildDependencies {
  /** Required by generated builders for fields encoded as Qubic `id` values. */
  readonly identityToPublicKey?: IdentityToPublicKey;
}

export type ActionFieldValueType =
  | "identity"
  | "identity-array"
  | "bigint"
  | "number"
  | "byte-array"
  | "asset"
  | "asset-array"
  | "struct";

export type ActionFieldValidation =
  | { readonly kind: "identity" }
  | { readonly kind: "identity-array"; readonly length: number }
  | { readonly kind: "integer"; readonly bits: 8 | 32 | 64; readonly signed: boolean }
  | { readonly kind: "byte-array"; readonly length: number }
  | { readonly kind: "asset" }
  | { readonly kind: "asset-array"; readonly length: number }
  | { readonly kind: "struct" };

export interface ActionField {
  readonly name: string;
  readonly required: true;
  readonly valueType: ActionFieldValueType;
  readonly validation: ActionFieldValidation;
  readonly fields?: readonly ActionField[];
}

export interface ActionValidationIssue {
  readonly field: string;
  readonly message: string;
}

export type ActionValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly ActionValidationIssue[] };

export type ActionAvailability =
  | {
      readonly status: "available";
      /** Evidence is intentionally limited to public API and ABI shape. */
      readonly evidence: string;
    }
  | {
      readonly status: "unavailable";
      /** Why this action must not be invoked by the starter UI. */
      readonly reason: string;
      /** The missing or conflicting public evidence. */
      readonly evidence: string;
    };

export interface ActionDefinition<TInput extends object = Record<string, never>, TOutput = never> {
  readonly id: string;
  /** ABI name or generated public operation name. */
  readonly name: string;
  readonly contractName: "QEarn" | "QUtil";
  readonly contractIndex: number;
  readonly inputType: number;
  readonly kind: "procedure" | "function";
  readonly fields: readonly ActionField[];
  readonly availability: ActionAvailability;
  readonly requiresIdentityToPublicKey: boolean;
  readonly validateInput: (input: unknown) => ActionValidationResult<TInput>;
  /** Present only for an available procedure with a confirmed generated builder. */
  readonly buildCall?: (input: TInput, dependencies?: ActionBuildDependencies) => ContractCall;
  /** Present only for an available function with a confirmed generated input builder. */
  readonly buildInput?: (input: TInput, dependencies?: ActionBuildDependencies) => Uint8Array;
  /** Present only for an available function with a confirmed generated query function. */
  readonly query?: (
    live: SmartContractCaller,
    input: TInput,
    options?: ContractCallOptions,
  ) => Promise<Result<TOutput, QubicRpcError>>;
}

export type ActionCatalog = readonly ActionDefinition[];

export function validateActionInput<TInput extends object>(
  fields: readonly ActionField[],
  input: unknown,
): ActionValidationResult<TInput> {
  const issues: ActionValidationIssue[] = [];

  if (!isRecord(input)) {
    return {
      ok: false,
      issues: [{ field: "input", message: "Expected an object." }],
    };
  }

  const knownFields = new Set(fields.map((field) => field.name));
  for (const key of Object.keys(input)) {
    if (!knownFields.has(key)) {
      issues.push({ field: key, message: "Unexpected field." });
    }
  }

  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(input, field.name)) {
      if (field.required) {
        issues.push({ field: field.name, message: "Field is required." });
      }
      continue;
    }

    validateField(field, input[field.name], field.name, issues);
  }

  return issues.length > 0
    ? { ok: false, issues }
    : { ok: true, value: input as TInput };
}

export function assertValidActionInput<TInput extends object>(
  fields: readonly ActionField[],
  input: TInput,
): TInput {
  const result = validateActionInput<TInput>(fields, input);
  if (!result.ok) {
    throw new Error(result.issues.map(({ field, message }) => `${field}: ${message}`).join("; "));
  }
  return result.value;
}

export function requireIdentityToPublicKey(
  dependencies: ActionBuildDependencies | undefined,
): IdentityToPublicKey {
  if (dependencies?.identityToPublicKey === undefined) {
    throw new Error("This action requires an identityToPublicKey dependency.");
  }
  return dependencies.identityToPublicKey;
}

function validateField(
  field: ActionField,
  value: unknown,
  path: string,
  issues: ActionValidationIssue[],
): void {
  switch (field.validation.kind) {
    case "identity":
      if (typeof value !== "string" || !isValidIdentityChecksum(value)) {
        issues.push({ field: path, message: "Expected a valid 60-character Qubic identity." });
      }
      return;
    case "identity-array":
      if (!Array.isArray(value) || value.length !== field.validation.length) {
        issues.push({ field: path, message: `Expected exactly ${field.validation.length} Qubic identities.` });
        return;
      }
      value.forEach((item, index) => {
        if (typeof item !== "string" || !isValidIdentityChecksum(item)) {
          issues.push({ field: `${path}[${index}]`, message: "Expected a valid Qubic identity." });
        }
      });
      return;
    case "integer":
      validateInteger(value, field.validation.bits, field.validation.signed, path, issues);
      return;
    case "byte-array":
      if (
        !Array.isArray(value) ||
        value.length !== field.validation.length ||
        value.some((item) => typeof item !== "number" || !Number.isInteger(item) || item < 0 || item > 255)
      ) {
        issues.push({ field: path, message: `Expected exactly ${field.validation.length} byte values.` });
      }
      return;
    case "asset":
      validateAsset(value, path, issues);
      return;
    case "asset-array":
      if (!Array.isArray(value) || value.length !== field.validation.length) {
        issues.push({ field: path, message: `Expected exactly ${field.validation.length} asset values.` });
        return;
      }
      value.forEach((item, index) => validateAsset(item, `${path}[${index}]`, issues));
      return;
    case "struct":
      if (!isRecord(value)) {
        issues.push({ field: path, message: "Expected an object." });
        return;
      }
      const nestedResult = validateActionInput(field.fields ?? [], value);
      if (!nestedResult.ok) {
        nestedResult.issues.forEach((issue) => {
          issues.push({ field: `${path}.${issue.field}`, message: issue.message });
        });
      }
      return;
  }
}

function validateAsset(value: unknown, path: string, issues: ActionValidationIssue[]): void {
  if (!isRecord(value)) {
    issues.push({ field: path, message: "Expected an asset object." });
    return;
  }
  if (typeof value.issuer !== "string" || !isValidIdentityChecksum(value.issuer)) {
    issues.push({ field: `${path}.issuer`, message: "Expected a valid Qubic identity." });
  }
  validateInteger(value.assetName, 64, false, `${path}.assetName`, issues);
}

function validateInteger(
  value: unknown,
  bits: 8 | 32 | 64,
  signed: boolean,
  path: string,
  issues: ActionValidationIssue[],
): void {
  const expectedType = bits === 64 ? "bigint" : "number";
  if (typeof value !== expectedType) {
    issues.push({ field: path, message: `Expected ${expectedType}.` });
    return;
  }

  if (bits === 64) {
    const bigintValue = value as bigint;
    const two = BigInt(2);
    const zero = BigInt(0);
    const one = BigInt(1);
    const minimum = signed ? -(two ** BigInt(bits - 1)) : zero;
    const maximum = signed ? two ** BigInt(bits - 1) - one : two ** BigInt(bits) - one;
    if (bigintValue < minimum || bigintValue > maximum) {
      issues.push({ field: path, message: `Expected a ${signed ? "signed" : "unsigned"} ${bits}-bit integer.` });
    }
    return;
  }

  const numberValue = value as number;
  const minimum = signed ? -(2 ** (bits - 1)) : 0;
  const maximum = signed ? 2 ** (bits - 1) - 1 : 2 ** bits - 1;
  if (!Number.isSafeInteger(numberValue) || numberValue < minimum || numberValue > maximum) {
    issues.push({ field: path, message: `Expected a ${signed ? "signed" : "unsigned"} ${bits}-bit integer.` });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
