import { publicKeyToIdentity } from "@qubic.org/crypto";
import { describe, expect, test } from "bun:test";
import {
  payloadToBase64,
  prepareLockQus,
  prepareSendToMany,
} from "./starter-procedures";

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

  test("builds one generated QUtil SendToMany V1 request per recipient", () => {
    const procedures = prepareSendToMany([
      { destination: recipient, amount: "2500000" },
      {
        destination: publicKeyToIdentity(new Uint8Array(32).fill(8)),
        amount: "3",
      },
    ]);
    const procedure = procedures[0];

    expect(procedure).toMatchObject({
      label: "Send to recipient 1",
      contractIndex: 4,
      inputType: 1,
      amount: "0",
    });
    expect(procedure.payload).toBeInstanceOf(Uint8Array);
    expect(procedure.payload).toHaveLength(40);
    expect(payloadToBase64(procedure.payload ?? new Uint8Array())).toHaveLength(
      56,
    );
    expect(procedures).toHaveLength(2);
    expect(procedures[1]).toMatchObject({ label: "Send to recipient 2" });
  });

  test("rejects unsafe direct procedure values before a wallet request", () => {
    expect(() => prepareLockQus("0")).toThrow("Amount must be at least 1.");
    expect(() => prepareSendToMany([])).toThrow("Add at least one recipient.");
    expect(() =>
      prepareSendToMany([{ destination: "not-an-identity", amount: "1" }]),
    ).toThrow("Recipient must be a valid Qubic identity.");
    expect(() =>
      prepareSendToMany([{ destination: recipient, amount: "0" }]),
    ).toThrow("Amount for recipient 1 must be at least 1.");
  });
});
