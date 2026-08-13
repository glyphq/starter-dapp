import {
  Q_UTIL_CONTRACT_INDEX,
  Q_UTIL_QUERY_PRICE_ORACLE_INPUT_TYPE,
  type QUtilQueryPriceOracleInput,
} from "@qubic.org/contracts";
import type { GlyphScCallInput } from "@/lib/connectors/glyph";

export const QUTIL_QUERY_PRICE_ORACLE_FEE_QU = "10";
export const QUTIL_QUERY_PRICE_ORACLE_TICK_OFFSET = 50;
export const QUTIL_QUERY_PRICE_ORACLE_TIMEOUT_MIN_SECONDS = 1;
export const QUTIL_QUERY_PRICE_ORACLE_TIMEOUT_MAX_SECONDS = 3_600;

export const qutilPriceOracleProviders = [
  { id: "binance", label: "Binance", description: "Price.h getBinanceOracleId()" },
  { id: "mexc", label: "MEXC", description: "Price.h getMexcOracleId()" },
  { id: "gate", label: "Gate.io", description: "Price.h getGateOracleId()" },
  { id: "binance_mexc", label: "Binance + MEXC mean", description: "Price.h getBinanceMexcOracleId()" },
  { id: "binance_gate", label: "Binance + Gate.io mean", description: "Price.h getBinanceGateOracleId()" },
  { id: "gate_mexc", label: "Gate.io + MEXC mean", description: "Price.h getGateMexcOracleId()" },
] as const;

export const qutilPriceOraclePairs = [
  { base: "BTC", quote: "USDT" },
  { base: "ETH", quote: "USDT" },
  { base: "BNB", quote: "USDT" },
  { base: "SOL", quote: "USDT" },
  { base: "XRP", quote: "USDT" },
  { base: "DOGE", quote: "USDT" },
  { base: "ADA", quote: "USDT" },
  { base: "AVAX", quote: "USDT" },
  { base: "LINK", quote: "USDT" },
  { base: "DOT", quote: "USDT" },
] as const;

type QutilPriceOracleProviderId = typeof qutilPriceOracleProviders[number]["id"];
type QutilPriceOraclePairKey = `${typeof qutilPriceOraclePairs[number]["base"]}/${typeof qutilPriceOraclePairs[number]["quote"]}`;

export type QUtilPriceOracleFormInput = {
  provider: string;
  pair: string;
  timestampUtc: string;
  timeoutSeconds: string;
};

export type QUtilPriceOracleRequestInput = {
  provider: QutilPriceOracleProviderId;
  baseCurrency: string;
  quoteCurrency: string;
  timestampValue: bigint;
  timeoutMilliseconds: number;
};

const providerIds = new Set<string>(qutilPriceOracleProviders.map((provider) => provider.id));
const pairKeys = new Set<string>(qutilPriceOraclePairs.map((pair) => `${pair.base}/${pair.quote}`));

function bytesToBase64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}

function writeOpaqueId(target: Uint8Array, offset: number, label: string, value: string) {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9_.-]{1,32}$/.test(normalized)) {
    throw new Error(`${label} must be 1 to 32 visible ASCII characters.`);
  }
  for (let index = 0; index < normalized.length; index += 1) {
    target[offset + index] = normalized.charCodeAt(index);
  }
}

export function encodeQpiDateTimeValue(date: Date) {
  const year = BigInt(date.getUTCFullYear());
  const month = BigInt(date.getUTCMonth() + 1);
  const day = BigInt(date.getUTCDate());
  const hour = BigInt(date.getUTCHours());
  const minute = BigInt(date.getUTCMinutes());
  const second = BigInt(date.getUTCSeconds());
  const millisecond = BigInt(date.getUTCMilliseconds());
  return (year << BigInt(46)) | (month << BigInt(42)) | (day << BigInt(37)) | (hour << BigInt(32)) | (minute << BigInt(26)) | (second << BigInt(20)) | (millisecond << BigInt(10));
}

export function formatDatetimeLocalUtc(date = new Date()) {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

function parseTimestampUtc(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) throw new Error("Enter a UTC timestamp in YYYY-MM-DDTHH:mm format.");
  const [, yearText, monthText, dayText, hourText, minuteText, secondText = "00"] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second, 0));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute ||
    date.getUTCSeconds() !== second
  ) {
    throw new Error("Enter a real UTC calendar date and time.");
  }
  if (date.getTime() > Date.now() + 60_000) {
    throw new Error("Choose a timestamp that is not in the future.");
  }
  return date;
}

export function validateQUtilPriceOracleInput(input: QUtilPriceOracleFormInput): QUtilPriceOracleRequestInput {
  const provider = input.provider.trim();
  if (!providerIds.has(provider)) {
    throw new Error("Choose one of the official Price oracle providers shown in the form.");
  }

  const pair = input.pair.trim().toUpperCase() as QutilPriceOraclePairKey;
  if (!pairKeys.has(pair)) {
    throw new Error("Choose one of the documented USDT pairs shown in the form.");
  }
  const [baseCurrency, quoteCurrency] = pair.split("/");

  const timeoutSeconds = Number(input.timeoutSeconds.trim());
  if (!Number.isInteger(timeoutSeconds) || timeoutSeconds < QUTIL_QUERY_PRICE_ORACLE_TIMEOUT_MIN_SECONDS || timeoutSeconds > QUTIL_QUERY_PRICE_ORACLE_TIMEOUT_MAX_SECONDS) {
    throw new Error("Timeout must be a whole number from 1 to 3600 seconds.");
  }

  const timestamp = parseTimestampUtc(input.timestampUtc);

  return {
    provider: provider as QutilPriceOracleProviderId,
    baseCurrency,
    quoteCurrency,
    timestampValue: encodeQpiDateTimeValue(timestamp),
    timeoutMilliseconds: timeoutSeconds * 1_000,
  };
}

export function toOfficialQUtilQueryPriceOracleInput(input: QUtilPriceOracleRequestInput): QUtilQueryPriceOracleInput {
  return {
    priceOracleQuery: {
      oracle: input.provider,
      timestamp: { value: input.timestampValue },
      currency1: input.baseCurrency,
      currency2: input.quoteCurrency,
    },
    timeoutMilliseconds: input.timeoutMilliseconds,
  };
}

export function buildQUtilQueryPriceOraclePayload(input: QUtilPriceOracleRequestInput) {
  // @qubic.org/contracts v1.0.1 exposes the official QUtil constants and
  // QueryPriceOracle input shape, but its generated builder maps id fields
  // through a zero-byte fallback. Price oracle ids are opaque QPI ASCII ids,
  // so encode those fields explicitly instead of silently submitting zeros.
  const officialInput = toOfficialQUtilQueryPriceOracleInput(input);
  const payload = new Uint8Array(108);
  const view = new DataView(payload.buffer);

  writeOpaqueId(payload, 0, "Provider id", officialInput.priceOracleQuery.oracle);
  view.setBigUint64(32, officialInput.priceOracleQuery.timestamp.value, true);
  writeOpaqueId(payload, 40, "Base currency id", officialInput.priceOracleQuery.currency1);
  writeOpaqueId(payload, 72, "Quote currency id", officialInput.priceOracleQuery.currency2);
  view.setUint32(104, officialInput.timeoutMilliseconds, true);

  return payload;
}

export function buildQUtilQueryPriceOracleRequest(input: QUtilPriceOracleRequestInput): GlyphScCallInput {
  return {
    contractIndex: Q_UTIL_CONTRACT_INDEX,
    inputType: Q_UTIL_QUERY_PRICE_ORACLE_INPUT_TYPE,
    payload: bytesToBase64(buildQUtilQueryPriceOraclePayload(input)),
    amount: QUTIL_QUERY_PRICE_ORACLE_FEE_QU,
    tickOffset: QUTIL_QUERY_PRICE_ORACLE_TICK_OFFSET,
  };
}
