import { describe, expect, test } from "bun:test";
import {
  QUBIC_EXPLORER_TRANSACTION_URL,
  pendingQUtilOracleConfirmation,
  resolveQUtilOracleConfirmation,
} from "./qutil-price-oracle-result";

const transactionId = "zvqvtjzvgwgpegmalkkjedhbdrnckqcfthpzfqzxbcljttljzidmvaxalxyz";

describe("QUtil price oracle archive status", () => {
  test("keeps a signed call pending until the official archive indexes an oracle status event", () => {
    const pending = pendingQUtilOracleConfirmation(transactionId, 42_000_001);

    expect(resolveQUtilOracleConfirmation(transactionId, { ok: true, value: { eventLogs: [] } }, pending)).toEqual(pending);
  });

  test("decodes only the authoritative query id and raw status from the latest archive event", () => {
    const confirmation = resolveQUtilOracleConfirmation(transactionId, {
      ok: true,
      value: {
        eventLogs: [
          { tickNumber: 100, logId: "1", oracleQueryStatusChange: { queryId: "44", queryStatus: "1" } },
          { tickNumber: 101, logId: "2", oracleQueryStatusChange: { queryId: "44", queryStatus: "2" } },
        ],
      },
    });

    expect(confirmation).toEqual({
      state: "confirmed",
      transactionId,
      queryId: "44",
      queryStatus: "2",
      tickNumber: 101,
    });
    expect(confirmation).not.toHaveProperty("price");
  });

  test("reports the result as unavailable when the official archive query is unavailable", () => {
    expect(resolveQUtilOracleConfirmation(transactionId, { ok: false })).toEqual({
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
