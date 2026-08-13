import { describe, expect, test } from "bun:test";
import {
  QUBIC_EXPLORER_TRANSACTION_URL,
  pendingRandomLotteryPurchase,
  resolveRandomLotteryPurchase,
} from "./random-lottery-result";

const transactionId = "zvqvtjzvgwgpegmalkkjedhbdrnckqcfthpzfqzxbcljttljzidmvaxalxyz";
const ticketPrice = BigInt(765_432);

describe("RandomLottery authoritative purchase status", () => {
  test("stays pending until the official archive indexes the exact paid empty-payload BuyTicket call", () => {
    const pending = pendingRandomLotteryPurchase(transactionId, 42_000_001);

    expect(resolveRandomLotteryPurchase(transactionId, ticketPrice, {
      ok: true,
      value: { hash: transactionId, inputType: 1, inputSize: 1, amount: ticketPrice.toString() },
    }, pending)).toEqual(pending);
  });

  test("reports archive confirmation without inventing an accepted or refunded contract result", () => {
    const confirmation = resolveRandomLotteryPurchase(transactionId, ticketPrice, {
      ok: true,
      value: { hash: transactionId, inputType: 1, inputSize: 0, amount: ticketPrice.toString(), tickNumber: 42_000_001, moneyFlew: true },
    });

    expect(confirmation).toEqual({
      state: "confirmed",
      transactionId,
      tickNumber: 42_000_001,
      moneyFlew: true,
    });
    expect(confirmation).not.toHaveProperty("accepted");
    expect(confirmation).not.toHaveProperty("refunded");
  });

  test("reports archive unavailability instead of fabricating a result", () => {
    expect(resolveRandomLotteryPurchase(transactionId, ticketPrice, { ok: false })).toEqual({
      state: "unavailable",
      transactionId,
      message: "The official Qubic archive could not be reached. Check the transaction in Explorer.",
    });
  });

  test("uses the official Explorer frontend transaction route", () => {
    expect(QUBIC_EXPLORER_TRANSACTION_URL(transactionId)).toBe(
      `https://explorer.qubic.org/network/tx/${transactionId}`,
    );
  });
});
