import { describe, expect, test } from "bun:test";
import {
  buildRandomLotteryBuyTicketRequest,
  fetchRandomLotteryPreflight,
} from "./random-lottery";

function bytesToBase64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}

function uint64Response(value: bigint) {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, value, true);
  return bytesToBase64(bytes);
}

function liveClient(responses: { ticketPrice?: bigint; currentState?: number; fail?: boolean }) {
  const requests: unknown[] = [];
  return {
    requests,
    client: {
      async querySmartContract(request: { inputType: number }) {
        requests.push(request);
        if (responses.fail) return { ok: false } as never;
        return {
          ok: true,
          value: {
            responseData: request.inputType === 4
              ? uint64Response(responses.ticketPrice ?? BigInt(0))
              : bytesToBase64(Uint8Array.of(responses.currentState ?? 0)),
          },
        } as never;
      },
    },
  };
}

describe("RandomLottery live preflight", () => {
  test("uses the official empty-input live schema and exposes the current price only when selling is open", async () => {
    const { client, requests } = liveClient({ ticketPrice: BigInt(765_432), currentState: 1 });

    await expect(fetchRandomLotteryPreflight(client)).resolves.toEqual({
      state: "open",
      ticketPrice: BigInt(765_432),
      currentState: 1,
    });
    expect(requests).toEqual(expect.arrayContaining([
      expect.objectContaining({ contractIndex: 16, inputType: 4, inputSize: 0, requestData: "" }),
      expect.objectContaining({ contractIndex: 16, inputType: 6, inputSize: 0, requestData: "" }),
    ]));
  });

  test("uses the newly read price rather than retaining a previous price", async () => {
    const first = liveClient({ ticketPrice: BigInt(321), currentState: 1 });
    const second = liveClient({ ticketPrice: BigInt(654_321), currentState: 1 });

    await expect(fetchRandomLotteryPreflight(first.client)).resolves.toMatchObject({ state: "open", ticketPrice: BigInt(321) });
    await expect(fetchRandomLotteryPreflight(second.client)).resolves.toMatchObject({ state: "open", ticketPrice: BigInt(654_321) });
  });

  test("blocks a closed sale and unavailable or invalid live price", async () => {
    const closed = liveClient({ ticketPrice: BigInt(123), currentState: 0 });
    const unavailable = liveClient({ fail: true });
    const invalid = liveClient({ ticketPrice: BigInt(0), currentState: 1 });

    await expect(fetchRandomLotteryPreflight(closed.client)).resolves.toEqual({ state: "closed", ticketPrice: BigInt(123), currentState: 0 });
    await expect(fetchRandomLotteryPreflight(unavailable.client)).resolves.toMatchObject({ state: "unavailable" });
    await expect(fetchRandomLotteryPreflight(invalid.client)).resolves.toMatchObject({ state: "unavailable" });
  });
});

describe("RandomLottery BuyTicket request", () => {
  test("sends contract 16 input type 1 with an explicit empty payload and the live price", () => {
    expect(buildRandomLotteryBuyTicketRequest(BigInt(765_432))).toEqual({
      contractIndex: 16,
      inputType: 1,
      payload: "",
      amount: "765432",
    });
  });

  test("never builds a paid request without a positive live price", () => {
    expect(() => buildRandomLotteryBuyTicketRequest(BigInt(0))).toThrow("positive live ticket price");
  });
});
