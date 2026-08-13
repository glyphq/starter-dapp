import { createQueryClient, type QueryClient, type QueryEvent } from "@qubic.org/rpc";

/** The route used by Qubic's official Explorer frontend for transaction pages. */
export const QUBIC_EXPLORER_TRANSACTION_URL = (transactionId: string) =>
  `https://explorer.qubic.org/network/tx/${encodeURIComponent(transactionId)}`;

const POLL_INTERVAL_MS = 4_000;

type OracleStatusEvent = Pick<QueryEvent, "tickNumber" | "logId" | "oracleQueryStatusChange">;

type OracleStatusResponse =
  | { ok: true; value: { eventLogs: readonly OracleStatusEvent[] } }
  | { ok: false };

export type QUtilOracleConfirmation =
  | {
      state: "pending";
      transactionId: string;
      targetTick?: number;
      queryId?: string;
    }
  | {
      state: "confirmed";
      transactionId: string;
      queryId: string;
      queryStatus: string;
      tickNumber?: number;
    }
  | {
      state: "unavailable";
      transactionId: string;
      message: string;
    };

export type QUtilOracleStatusClient = Pick<QueryClient, "getEventLogs">;

export function pendingQUtilOracleConfirmation(transactionId: string, targetTick?: number): QUtilOracleConfirmation {
  return { state: "pending", transactionId, targetTick };
}

function queryIdFromConfirmation(confirmation?: QUtilOracleConfirmation) {
  return confirmation?.state === "pending" || confirmation?.state === "confirmed"
    ? confirmation.queryId
    : undefined;
}

function isAuthoritativeOracleStatus(event: OracleStatusEvent) {
  const status = event.oracleQueryStatusChange;
  return typeof status?.queryId === "string" && status.queryId.length > 0
    && typeof status.queryStatus === "string" && status.queryStatus.length > 0;
}

function newestOracleStatus(events: readonly OracleStatusEvent[]) {
  return events
    .filter(isAuthoritativeOracleStatus)
    .sort((left, right) => {
      const byTick = (right.tickNumber ?? 0) - (left.tickNumber ?? 0);
      if (byTick !== 0) return byTick;
      return Number(right.logId ?? 0) - Number(left.logId ?? 0);
    })[0];
}

/**
 * The public archive API exposes oracle status-change events, not a price reply.
 * Decode only the documented query id and raw status fields and never infer a price.
 */
export function resolveQUtilOracleConfirmation(
  transactionId: string,
  response: OracleStatusResponse,
  previous?: QUtilOracleConfirmation,
): QUtilOracleConfirmation {
  if (!response.ok) {
    return {
      state: "unavailable",
      transactionId,
      message: "The official Qubic archive could not be reached. Check the transaction in Explorer.",
    };
  }

  const event = newestOracleStatus(response.value.eventLogs);
  if (!event) {
    return {
      state: "pending",
      transactionId,
      targetTick: previous?.state === "pending" ? previous.targetTick : undefined,
      queryId: queryIdFromConfirmation(previous),
    };
  }

  const status = event.oracleQueryStatusChange!;
  return {
    state: "confirmed",
    transactionId,
    queryId: status.queryId!,
    queryStatus: status.queryStatus!,
    tickNumber: event.tickNumber,
  };
}

export async function fetchQUtilOracleConfirmation(
  transactionId: string,
  previous?: QUtilOracleConfirmation,
  client: QUtilOracleStatusClient = createQueryClient(),
): Promise<QUtilOracleConfirmation> {
  const queryId = queryIdFromConfirmation(previous);
  const response = await client.getEventLogs({
    filters: queryId ? { queryId } : { transactionHash: transactionId },
    pagination: { offset: 0, size: 10 },
  });

  return resolveQUtilOracleConfirmation(transactionId, response, previous);
}

function waitForNextPoll(signal?: AbortSignal) {
  return new Promise<void>((resolve) => {
    const timer = window.setTimeout(resolve, POLL_INTERVAL_MS);
    signal?.addEventListener("abort", () => {
      window.clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

/** Poll documented archive status events while this page remains open. */
export async function pollQUtilOracleConfirmation({
  transactionId,
  targetTick,
  signal,
  onUpdate,
  client,
}: {
  transactionId: string;
  targetTick?: number;
  signal?: AbortSignal;
  onUpdate: (confirmation: QUtilOracleConfirmation) => void;
  client?: QUtilOracleStatusClient;
}) {
  let confirmation = pendingQUtilOracleConfirmation(transactionId, targetTick);
  onUpdate(confirmation);

  while (!signal?.aborted) {
    confirmation = await fetchQUtilOracleConfirmation(transactionId, confirmation, client);
    onUpdate(confirmation);
    if (confirmation.state === "unavailable") return confirmation;
    await waitForNextPoll(signal);
  }

  return confirmation;
}
