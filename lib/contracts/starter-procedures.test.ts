import { publicKeyToIdentity } from "@qubic.org/crypto";
import { describe, expect, test } from "bun:test";
import { prepareLockQus, prepareSendQus } from "./starter-procedures";

const recipient = publicKeyToIdentity(new Uint8Array(32).fill(7));

describe("reviewed starter procedures", () => {
  test("builds QEarn Lock with the whole QU amount attached", () => {
    expect(prepareLockQus("1000000")).toEqual({
      label: "Lock QUs",
      contractIndex: 9,
      inputType: 1,
      amount: "1000000",
    });
  });

  test("builds a direct whole-QU transfer for a normalized Qubic identity", () => {
    expect(prepareSendQus(recipient.toLowerCase(), "2500000")).toEqual({
      label: "Send QUs",
      destination: recipient,
      amount: "2500000",
    });
  });

  test("rejects unsafe direct procedure values before a wallet request", () => {
    expect(() => prepareLockQus("0")).toThrow("Amount must be at least 1.");
    expect(() => prepareSendQus("not-an-identity", "1")).toThrow(
      "Recipient must be a valid Qubic identity.",
    );
    expect(() => prepareSendQus(recipient, "0")).toThrow(
      "Amount must be at least 1.",
    );
  });
});
