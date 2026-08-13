import {
  RANDOM_LOTTERY_BUY_TICKET_INPUT_TYPE,
} from "@qubic.org/contracts";
import { createQueryClient, type QueryClient, type QueryTransaction } from "@qubic.org/rpc";

/** The route used by Qubic's official Explorer frontend for transaction pages. */
export const QUBIC_EXPLORER_TRANSACTION_URL = (transactionId: string) =>
  `https://explorer.qubic.org/network/tx/${encodeURIComponent(transactionId)}`;

const POLL_INTERVAL_MS = 4_000;

export type RandomLotteryPurchaseConfirmation =
  | {
      state: "pending";
      transactionId: string;
      targetTick?: number;
    }
  | {
      state: "confirmed";
      transactionId: string;
      tickNumber?: number;
      moneyFlew?: boolean;
    }
  | {
      state: "unavailable";
      transactionId: string;
      message: string;
    };

export type RandomLotteryPurchaseStatusClient = Pick<QueryClient, "getTransactionByHash">;

export function pendingRandomLotteryPurchase(
  transactionId: string,
  targetTick?: number,
): RandomLotteryPurchaseConfirmation {
  return { state: "pending", transactionId, targetTick };
}

function isSubmittedBuyTicket(
  transaction: QueryTransaction,
  transactionId: string,
  ticketPrice: bigint,
) {
  return transaction.hash === transactionId
    && transaction.inputType === RANDOM_LOTTERY_BUY_TICKET_INPUT_TYPE
    && transaction.inputSize === 0
    && transaction.amount === ticketPrice.toString();
}

/**
 * The official archive confirms that the signed transaction was indexed, but
 * does not expose a procedure return code or classify BuyTicket refunds. Do
 * not infer an accepted or refunded entry from `moneyFlew` alone.
 */
export function resolveRandomLotteryPurchase(
  transactionId: string,
  ticketPrice: bigint,
  response: { ok: true; value: QueryTransaction } | { ok: false },
  previous?: RandomLotteryPurchaseConfirmation,
): RandomLotteryPurchaseConfirmation {
  if (!response.ok) {
    return {
      state: "unavailable",
      transactionId,
      message: "The official Qubic archive could not be reached. Check the transaction in Explorer.",
    };
  }

  if (!isSubmittedBuyTicket(response.value, transactionId, ticketPrice)) {
    return previous?.state === "pending"
      ? previous
      : pendingRandomLotteryPurchase(transactionId);
  }

  return {
    state: "confirmed",
    transactionId,
    tickNumber: response.value.tickNumber,
    ...(typeof response.value.moneyFlew === "boolean" ? { moneyFlew: response.value.moneyFlew } : {}),
  };
}

export async function fetchRandomLotteryPurchaseConfirmation(
  transactionId: string,
  ticketPrice: bigint,
  previous?: RandomLotteryPurchaseConfirmation,
  client: RandomLotteryPurchaseStatusClient = createQueryClient(),
): Promise<RandomLotteryPurchaseConfirmation> {
  const response = await client.getTransactionByHash(transactionId);
  return resolveRandomLotteryPurchase(transactionId, ticketPrice, response, previous);
}

function waitForNextPoll(signal?: AbortSignal) {
  return new Promise<void>((resolve) => {
    const timer = globalThis.setTimeout(resolve, POLL_INTERVAL_MS);
    signal?.addEventListener("abort", () => {
      globalThis.clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

/** Poll the official archive while the page remains open. */
export async function pollRandomLotteryPurchaseConfirmation({
  transactionId,
  ticketPrice,
  targetTick,
  signal,
  onUpdate,
  client,
}: {
  transactionId: string;
  ticketPrice: bigint;
  targetTick?: number;
  signal?: AbortSignal;
  onUpdate: (confirmation: RandomLotteryPurchaseConfirmation) => void;
  client?: RandomLotteryPurchaseStatusClient;
}) {
  let confirmation = pendingRandomLotteryPurchase(transactionId, targetTick);
  onUpdate(confirmation);

  while (!signal?.aborted) {
    confirmation = await fetchRandomLotteryPurchaseConfirmation(transactionId, ticketPrice, confirmation, client);
    onUpdate(confirmation);
    if (confirmation.state === "confirmed" || confirmation.state === "unavailable") return confirmation;
    await waitForNextPoll(signal);
  }

  return confirmation;
}
