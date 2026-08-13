import { describe, expect, test } from "bun:test";
import {
  buildQUtilQueryPriceOraclePayload,
  buildQUtilQueryPriceOracleRequest,
  encodeQpiDateTimeValue,
  formatDatetimeLocalUtc,
  validateQUtilPriceOracleInput,
} from "./qutil-price-oracle";

function bytesToBase64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}

function writeAsciiId(target: Uint8Array, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    target[offset + index] = value.charCodeAt(index);
  }
}

function fixedQuery() {
  return {
    provider: "binance" as const,
    baseCurrency: "BTC",
    quoteCurrency: "USDT",
    timestampValue: encodeQpiDateTimeValue(new Date(Date.UTC(2024, 1, 21, 12, 34, 56))),
    timeoutMilliseconds: 60_000,
  };
}

describe("QUtil QueryPriceOracle request builder", () => {
  test("builds the exact glyph sc_call request with the 10 QU burned query fee", () => {
    const query = fixedQuery();
    const expectedPayload = new Uint8Array(108);
    const view = new DataView(expectedPayload.buffer);
    writeAsciiId(expectedPayload, 0, "binance");
    view.setBigUint64(32, query.timestampValue, true);
    writeAsciiId(expectedPayload, 40, "BTC");
    writeAsciiId(expectedPayload, 72, "USDT");
    view.setUint32(104, 60_000, true);

    expect(buildQUtilQueryPriceOracleRequest(query)).toEqual({
      contractIndex: 4,
      inputType: 100,
      payload: bytesToBase64(expectedPayload),
      amount: "10",
      tickOffset: 50,
    });
  });

  test("encodes opaque provider and currency ids as explicit ASCII bytes, never zero fallbacks", () => {
    const payload = buildQUtilQueryPriceOraclePayload(fixedQuery());

    expect(new TextDecoder().decode(payload.slice(0, 7))).toBe("binance");
    expect([...payload.slice(7, 32)]).toEqual(new Array(25).fill(0));
    expect(new TextDecoder().decode(payload.slice(40, 43))).toBe("BTC");
    expect(new TextDecoder().decode(payload.slice(72, 76))).toBe("USDT");
  });
});

describe("QUtil QueryPriceOracle input validation", () => {
  test("accepts official provider ids, documented pairs, UTC timestamp, and timeout range", () => {
    expect(validateQUtilPriceOracleInput({
      provider: "gate_mexc",
      pair: "eth/usdt",
      timestampUtc: "2024-02-21T12:34",
      timeoutSeconds: "60",
    })).toEqual({
      provider: "gate_mexc",
      baseCurrency: "ETH",
      quoteCurrency: "USDT",
      timestampValue: encodeQpiDateTimeValue(new Date(Date.UTC(2024, 1, 21, 12, 34, 0))),
      timeoutMilliseconds: 60_000,
    });
  });

  test("rejects unknown providers, arbitrary pairs, invalid timestamps, future timestamps, and bad timeouts", () => {
    const valid = {
      provider: "binance",
      pair: "BTC/USDT",
      timestampUtc: "2024-02-21T12:34",
      timeoutSeconds: "60",
    };

    expect(() => validateQUtilPriceOracleInput({ ...valid, provider: "coinbase" })).toThrow("official Price oracle providers");
    expect(() => validateQUtilPriceOracleInput({ ...valid, pair: "QUBIC/USD" })).toThrow("documented USDT pairs");
    expect(() => validateQUtilPriceOracleInput({ ...valid, timestampUtc: "2024-02-31T12:34" })).toThrow("real UTC calendar");
    expect(() => validateQUtilPriceOracleInput({ ...valid, timestampUtc: formatDatetimeLocalUtc(new Date(Date.now() + 120_000)) })).toThrow("not in the future");
    expect(() => validateQUtilPriceOracleInput({ ...valid, timeoutSeconds: "0" })).toThrow("1 to 3600");
    expect(() => validateQUtilPriceOracleInput({ ...valid, timeoutSeconds: "3601" })).toThrow("1 to 3600");
  });
});
