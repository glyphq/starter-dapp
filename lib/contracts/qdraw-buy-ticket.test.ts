import { describe, expect, test } from "bun:test";
import { buildQdrawBuyTicketInput } from "@qubic.org/contracts";

describe("QDraw BuyTicket contract builder", () => {
  test("builds the official one-field ticket payload", () => {
    const call = buildQdrawBuyTicketInput({ ticketCount: BigInt(1) });

    expect(call.contractIndex).toBe(15);
    expect(call.inputType).toBe(1);
    expect([...call.payload]).toEqual([1, 0, 0, 0, 0, 0, 0, 0]);
  });
});
