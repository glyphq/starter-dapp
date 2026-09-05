import { identityToPublicKey, type Identity } from "@qubic.org/crypto";
import * as contracts from "@qubic.org/contracts";

export type PreparedProcedure = {
  label: string;
  contractIndex: number;
  inputType: number;
  payload?: Uint8Array;
  amount: string;
};

function parseWholeNumber(value: string, label: string, minimum = BigInt(0)) {
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

function toSafeInteger(
  value: string,
  label: string,
  maximum: bigint,
  minimum = BigInt(0),
) {
  const parsed = parseWholeNumber(value, label, minimum);
  if (parsed > maximum) throw new Error(`${label} is too large.`);
  return parsed;
}

function recipientIdentity(value: string) {
  const identity = value.trim().toUpperCase();
  if (!/^[A-Z]{60}$/.test(identity)) {
    throw new Error("Recipient must be a valid Qubic identity.");
  }

  try {
    identityToPublicKey(identity as Identity);
  } catch {
    throw new Error("Recipient must be a valid Qubic identity.");
  }

  return identity;
}

/** Builds the QEarn lock request with the entered QU attached to contract 9. */
export function prepareLockQus(amount: string): PreparedProcedure {
  const value = toSafeInteger(
    amount,
    "Amount",
    BigInt("18446744073709551615"),
    BigInt(1),
  );

  return {
    label: "Lock QUs",
    contractIndex: contracts.qearn.contractIndex,
    inputType: contracts.QEARN_LOCK_INPUT_TYPE,
    amount: value.toString(),
  };
}

export type PreparedTransfer = {
  label: string;
  destination: string;
  amount: string;
};

/** Builds a direct positive whole-QU transfer for the active wallet. */
export function prepareSendQus(
  destination: string,
  amount: string,
): PreparedTransfer {
  const value = toSafeInteger(
    amount,
    "Amount",
    BigInt("18446744073709551615"),
    BigInt(1),
  );

  return {
    label: "Send QUs",
    destination: recipientIdentity(destination),
    amount: value.toString(),
  };
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
