/** Qubic SchnorrQ signatures are 64 bytes (128 hex characters), per @qubic.org/crypto.
 * Validate without changing the message bytes that will be signed. */
export function validateSignatureInputs(
  message: string,
  signature?: string,
): string | null {
  if (!message.trim()) return "Enter a message.";
  if (signature !== undefined && !/^[0-9a-fA-F]{128}$/.test(signature)) {
    return "Enter a 128-character hexadecimal signature (without 0x).";
  }
  return null;
}

export function signatureBytes(signature: string): Uint8Array {
  if (!/^[0-9a-fA-F]{128}$/.test(signature)) {
    throw new Error("Invalid signature hex.");
  }
  return Uint8Array.from(signature.match(/.{2}/g)!, (byte) =>
    Number.parseInt(byte, 16),
  );
}
