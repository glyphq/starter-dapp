import { identityToPublicKey, type Identity } from "@qubic.org/crypto";
import * as contracts from "@qubic.org/contracts";

export type PreparedProcedure = {
  label: string;
  contractIndex: number;
  inputType: number;
  payload?: Uint8Array;
  amount: string;
};

export type SendToManyRecipient = {
  destination: string;
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

/**
 * Builds QUtil's generated SendToMany V1 calls. The ABI encodes one destination
 * and amount per request, so a multi-recipient form creates a reviewed queue
 * that requires an explicit wallet approval for every recipient.
 */
export function prepareSendToMany(
  recipients: readonly SendToManyRecipient[],
): PreparedProcedure[] {
  if (!recipients.length) throw new Error("Add at least one recipient.");

  return recipients.map(({ destination, amount }, index) => {
    const recipient = recipientIdentity(destination);
    const value = toSafeInteger(
      amount,
      `Amount for recipient ${index + 1}`,
      BigInt("9223372036854775807"),
      BigInt(1),
    );
    const call = contracts.qUtil.buildSendToManyV1Input(
      { dst0: recipient, amt0: value },
      (identity) => identityToPublicKey(identity as Identity),
    );

    return {
      label: `QUtil SendToMany V1 for recipient ${index + 1}`,
      contractIndex: call.contractIndex,
      inputType: call.inputType,
      payload: call.payload,
      amount: "0",
    };
  });
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
