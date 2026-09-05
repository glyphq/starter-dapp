import { identityToPublicKey, k12, verify } from "@qubic.org/crypto";
import {
  createConnectRequest,
  createScCallRequest,
  createSignMessageRequest,
  createTransferRequest,
  createVerifyMessageRequest,
  createEnvelope,
  launchGlyphRequest,
  prepareRelaySession,
  subscribeViaRelayV2,
  type GlyphPermission,
  type GlyphRequest,
  type GlyphCallbackResponse,
  type GlyphEnvelope,
  type GlyphScCallRequest,
  type GlyphSignedCallbackEnvelope,
  type GlyphNetworkBinding,
  type GlyphPreparedRelaySession,
  type GlyphRelayErrorCode,
  type GlyphRequestStatus,
  type GlyphRequestType,
} from "@glyph-oss/connect";
import type {
  SignMessageResult,
  WalletAccount,
  WalletConnector,
  WalletConnectorEvent,
} from "@qubic.org/react";
import type { Identity } from "@qubic.org/types";
import type {
  GlyphRelayAdapter,
  GlyphRelayDiagnosticEvent,
  GlyphRelayDiagnosticSnapshot,
} from "./glyph-relay-adapter";
import { getGlyphAppOrigin } from "./glyph-origin";

const STORAGE_KEY = "glyph-starter-account";
export const GLYPH_REQUEST_STATUS_EVENT = "glyph:request-status";
/** Every Glyph request from this dApp is explicitly bound to Qubic mainnet. */
export const GLYPH_MAINNET_NETWORK: GlyphNetworkBinding = { id: "qubic:mainnet" };

export type GlyphRequestMilestone =
  | "preparing"
  | "opening"
  | "awaiting_approval"
  | "recovering"
  | "verifying"
  | "completed"
  | "interrupted"
  | "failed";

export type GlyphFailureCode =
  | "session_not_ready"
  | "preparation_failed"
  | "relay_unavailable"
  | "relay_timeout"
  | "relay_closed"
  | "wallet_rejected"
  | "verification_failed"
  | "invalid_response"
  | "launch_failed"
  | "unknown";

export type GlyphRequestFeedback =
  {
    requestId: string;
    requestType: GlyphRequestType;
    state: GlyphRequestMilestone;
    failureCode?: GlyphFailureCode;
    relayErrorCode?: GlyphRelayErrorCode;
    relayMilestone?: GlyphRelayDiagnosticEvent["milestone"];
    supportId?: string | null;
    pollAttempt?: number;
    pollMaxAttempts?: number;
  };

export type GlyphSafeDiagnostic = {
  schema: "glyph-starter-diagnostic/v1";
  connector: "glyph-wallet";
  protocol: "connect-v2";
  network: "qubic:mainnet";
  request_type: GlyphRequestType;
  milestone: GlyphRequestMilestone;
  failure_code: GlyphFailureCode | null;
  relay_error_code: GlyphRelayErrorCode | null;
  support_id: string | null;
  poll_attempt: number;
  poll_max_attempts: number;
  retry_available: boolean;
};

export type GlyphScCallInput = {
  /** Contract index defined by the target contract's public ABI. */
  contractIndex: number;
  /** Input type defined by the target contract's public ABI. */
  inputType: number;
  /** ABI-encoded payload defined by the target contract. Passed through unchanged. */
  payload?: string;
  /** Optional mainnet amount, represented as a decimal integer string. */
  amount?: string;
  /** Optional wallet tick offset. */
  tickOffset?: number;
};

const permissions: GlyphPermission[] = ["transfer", "sc_call", "sign_message"];
// Keep recovery long enough to cover normal callback persistence latency while
// bounding a missing callback to a short, retryable failure. Twelve quick
// attempts at 250 ms cover roughly three seconds of pending responses; the
// SDK's total budget remains the hard upper bound.
const GLYPH_RELAY_POLL_TIMEOUT_MS = 2_000;
const GLYPH_RELAY_POLL_INTERVAL_MS = 250;
const GLYPH_RELAY_MAX_POLL_ATTEMPTS = 12;
const GLYPH_RELAY_RECOVERY_TIMEOUT_MS = 3_500;
const listeners = new Map<WalletConnectorEvent, Set<(...args: unknown[]) => void>>();
let preparedRelaySession: GlyphPreparedRelaySession | null = null;
let relaySessionPreparation: Promise<void> | null = null;
let localRequestSequence = 0;
// A relay session is single-use, but a second event handler can still reach a
// request helper while the first request is awaiting the wallet callback. Keep
// the complete action single-flight per request type so duplicate React
// handlers, propagated clicks, or direct callers share its one envelope,
// validation, and lifecycle result.
const inFlightGlyphRequests = new Map<GlyphRequestType, Promise<unknown>>();

/** Runtime binding for the published Connect 4.1.0 API, kept behind the seam. */
export const glyphRelayAdapter: GlyphRelayAdapter = {
  prepare: prepareRelaySession,
  subscribe: subscribeViaRelayV2,
  launch: launchGlyphRequest,
};

class GlyphRequestFailure extends Error {
  readonly code: GlyphFailureCode;

  constructor(code: GlyphFailureCode, message: string) {
    super(message);
    this.name = "GlyphRequestFailure";
    this.code = code;
  }
}

type GlyphRequestCorrelation = {
  requestId: string;
  requestType: GlyphRequestType;
  relayErrorCode?: GlyphRelayErrorCode;
  relayMilestone?: GlyphRelayDiagnosticEvent["milestone"];
  supportId?: string | null;
  pollAttempt?: number;
  pollMaxAttempts?: number;
};

type GlyphRequestExecution = {
  result: GlyphCallbackResponse;
  correlation: GlyphRequestCorrelation;
};

const REQUEST_NOT_READY_MESSAGE =
  "Glyph Wallet is preparing a secure relay session. Wait until it is ready, then try again.";

function dapp() {
  return { name: "Glyph Qubic Starter", origin: getGlyphAppOrigin() };
}

function emit(event: WalletConnectorEvent, ...args: unknown[]) {
  listeners.get(event)?.forEach((listener) => {
    try {
      listener(...args);
    } catch {
      // Connector event subscribers are advisory and must not turn a verified
      // wallet result into a rejected operation.
    }
  });
}

function emitRequestFeedback(detail: GlyphRequestFeedback) {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent<GlyphRequestFeedback>(GLYPH_REQUEST_STATUS_EVENT, { detail }));
  } catch {
    // Lifecycle feedback must never break the request or expose a raw error.
  }
}

function nextRequestCorrelation(request: GlyphRequest): GlyphRequestCorrelation {
  localRequestSequence += 1;
  return {
    // This identifier is created and consumed only in this dApp. It is never
    // added to the request, envelope, deep-link URL, or signed verification.
    requestId: `local-${localRequestSequence}`,
    requestType: request.type,
  };
}

function emitLifecycle(
  correlation: GlyphRequestCorrelation,
  state: GlyphRequestMilestone,
  failureCode?: GlyphFailureCode,
) {
  emitRequestFeedback({ ...correlation, state, ...(failureCode ? { failureCode } : {}) });
}

const relayErrorCodes: ReadonlySet<GlyphRelayErrorCode> = new Set([
  "invalid_options",
  "registration_timeout",
  "registration_failed",
  "stream_timeout",
  "stream_interrupted",
  "stream_failed",
  "poll_timeout",
  "poll_failed",
  "poll_exhausted",
  "result_pending",
  "callback_invalid",
  "callback_verification_failed",
  "aborted",
]);

function safeRelayErrorCode(error: unknown): GlyphRelayErrorCode | undefined {
  if (!error || typeof error !== "object") return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && relayErrorCodes.has(code as GlyphRelayErrorCode)
    ? code as GlyphRelayErrorCode
    : undefined;
}

function safeSupportId(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9_-]{1,64}$/.test(value) ||
    value.startsWith("c_") ||
    value.startsWith("r_")
  ) {
    return undefined;
  }
  return value;
}

function safeRelaySupportId(error: unknown): string | null | undefined {
  if (!error || typeof error !== "object") return undefined;
  return safeSupportId((error as { supportId?: unknown }).supportId);
}

function relayFailureCode(code: GlyphRelayErrorCode | undefined): GlyphFailureCode {
  switch (code) {
    case "callback_verification_failed": return "verification_failed";
    case "callback_invalid": return "invalid_response";
    case "registration_timeout":
    case "registration_failed":
    case "stream_failed":
    case "poll_failed":
      return "relay_unavailable";
    case "stream_timeout":
    case "poll_timeout":
    case "poll_exhausted":
    case "result_pending":
      return "relay_timeout";
    case "stream_interrupted":
    case "aborted":
      return "relay_closed";
    case "invalid_options":
      return "unknown";
    default:
      return "unknown";
  }
}

function relayDiagnosticFields(input: {
  error?: unknown;
  relayErrorCode?: GlyphRelayErrorCode;
  supportId?: string | null;
  relayMilestone?: GlyphRelayDiagnosticEvent["milestone"];
  pollAttempt?: number;
  pollMaxAttempts?: number;
}): Pick<GlyphRequestFeedback, "relayErrorCode" | "relayMilestone" | "supportId" | "pollAttempt" | "pollMaxAttempts"> {
  const relayErrorCode = input.relayErrorCode ?? safeRelayErrorCode(input.error);
  return {
    ...(relayErrorCode ? { relayErrorCode } : {}),
    ...(input.relayMilestone ? { relayMilestone: input.relayMilestone } : {}),
    ...(input.supportId !== undefined ? { supportId: safeSupportId(input.supportId) } : {}),
    ...(input.pollAttempt !== undefined ? { pollAttempt: input.pollAttempt } : {}),
    ...(input.pollMaxAttempts !== undefined ? { pollMaxAttempts: input.pollMaxAttempts } : {}),
  };
}

function rememberRelayDiagnostic(correlation: GlyphRequestCorrelation, feedback: GlyphRequestFeedback) {
  Object.assign(correlation, relayDiagnosticFields({
    relayErrorCode: feedback.relayErrorCode,
    supportId: feedback.supportId,
    relayMilestone: feedback.relayMilestone,
    pollAttempt: feedback.pollAttempt,
    pollMaxAttempts: feedback.pollMaxAttempts,
  }));
  emitRequestFeedback(feedback);
}

function classifyFailure(error: unknown): GlyphFailureCode {
  if (error instanceof GlyphRequestFailure) return error.code;
  const safeCode = safeRelayErrorCode(error);
  if (safeCode) return relayFailureCode(safeCode);
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("timed out") || message.includes("timeout")) return "relay_timeout";
  if (message.includes("closed without") || message.includes("ended without")) return "relay_closed";
  if (
    message.includes("signature") ||
    message.includes("signed glyph callback") ||
    message.includes("request_hash") ||
    message.includes("network does not match") ||
    message.includes("callback_url does not match")
  ) {
    return "verification_failed";
  }
  if (message.includes("relay") || message.includes("fetch") || message.includes("network")) {
    return "relay_unavailable";
  }
  return "unknown";
}

function isInterruptedFailure(code: GlyphFailureCode) {
  return (
    code === "relay_unavailable" ||
    code === "relay_timeout" ||
    code === "relay_closed" ||
    code === "wallet_rejected"
  );
}

function failureMessage(code: GlyphFailureCode) {
  switch (code) {
    case "session_not_ready":
      return REQUEST_NOT_READY_MESSAGE;
    case "preparation_failed":
      return "The secure Glyph session could not be prepared. Try again to create a new session.";
    case "relay_unavailable":
      return "The secure Glyph relay could not be reached. Prepare a new session and retry.";
    case "relay_timeout":
      return "The approval window expired without a response. Start a new request to retry.";
    case "relay_closed":
      return "The approval flow ended before a response arrived. Start a new request to retry.";
    case "wallet_rejected":
      return "The request was rejected in Glyph Wallet.";
    case "verification_failed":
      return "The wallet response could not be verified, so it was not accepted.";
    case "invalid_response":
      return "Glyph Wallet returned an unsupported response, so it was not accepted.";
    case "launch_failed":
      return "Glyph Wallet could not be opened. Try again from the request button.";
    case "unknown":
      return "The Glyph request could not be completed. Start a new request to retry.";
  }
}

export function glyphFailureMessage(code: GlyphFailureCode) {
  return failureMessage(code);
}

export function glyphRequestMilestoneLabel(state: GlyphRequestMilestone) {
  switch (state) {
    case "preparing": return "Preparing";
    case "opening": return "Opening";
    case "awaiting_approval": return "Awaiting approval";
    case "recovering": return "Recovering result";
    case "verifying": return "Verifying";
    case "completed": return "Completed";
    case "interrupted": return "Interrupted";
    case "failed": return "Failed";
  }
}

export function isGlyphRequestRetryable(state: GlyphRequestMilestone) {
  return state === "interrupted" || state === "failed";
}

/**
 * Return a deliberately allow-listed diagnostic. Do not add request data here:
 * the output must remain safe to copy into an issue without exposing callback
 * capabilities, URLs, signed data, proof material, or user input.
 */
export function buildGlyphSafeDiagnostic(feedback: GlyphRequestFeedback): string {
  const diagnostic: GlyphSafeDiagnostic = {
    schema: "glyph-starter-diagnostic/v1",
    connector: "glyph-wallet",
    protocol: "connect-v2",
    network: "qubic:mainnet",
    request_type: feedback.requestType,
    milestone: feedback.state,
    failure_code: feedback.failureCode ?? null,
    relay_error_code: feedback.relayErrorCode ?? null,
    support_id: safeSupportId(feedback.supportId) ?? null,
    poll_attempt: feedback.pollAttempt ?? 0,
    poll_max_attempts: feedback.pollMaxAttempts ?? 0,
    retry_available: isGlyphRequestRetryable(feedback.state),
  };
  return JSON.stringify(diagnostic, null, 2);
}

function mapRelayStatus(
  correlation: GlyphRequestCorrelation,
  status: GlyphRequestStatus,
): GlyphRequestFeedback {
  switch (status.state) {
    case "opening_wallet": return { ...correlation, state: "opening" };
    case "awaiting_approval": return { ...correlation, state: "awaiting_approval" };
    // The SDK calls this after its signed callback verification. The starter
    // keeps a visible verifying milestone while it validates the typed result
    // against the action-specific connector contract below.
    case "completed": return { ...correlation, state: "verifying" };
    case "failed": {
      const failureCode = classifyFailure(status.error);
      return {
        ...correlation,
        state: isInterruptedFailure(failureCode) ? "interrupted" : "failed",
        failureCode,
        ...relayDiagnosticFields({
          error: status.error,
          supportId: safeRelaySupportId(status.error),
        }),
      };
    }
  }
}

function mapRelaySnapshot(
  correlation: GlyphRequestCorrelation,
  snapshot: GlyphRelayDiagnosticSnapshot,
): GlyphRequestFeedback {
  const failureCode = snapshot.error ? relayFailureCode(snapshot.error.code) : undefined;
  const state = snapshot.state === "registering"
    ? "preparing"
    : snapshot.state === "opening_wallet"
      ? "opening"
      : snapshot.state === "awaiting_approval"
        ? "awaiting_approval"
        : snapshot.state === "recovering" || snapshot.pollAttempt > 0
          ? "recovering"
          : snapshot.state === "completed"
            ? "verifying"
            : isInterruptedFailure(failureCode ?? "unknown") ? "interrupted" : "failed";
  return {
    ...correlation,
    state,
    ...(failureCode ? { failureCode } : {}),
    ...relayDiagnosticFields({
      error: snapshot.error,
      supportId: snapshot.supportId,
      relayMilestone: snapshot.milestone,
      pollAttempt: snapshot.pollAttempt,
      pollMaxAttempts: snapshot.pollMaxAttempts,
    }),
  };
}

function mapRelayEvent(
  correlation: GlyphRequestCorrelation,
  event: GlyphRelayDiagnosticEvent,
): GlyphRequestFeedback {
  const failureCode = event.error ? relayFailureCode(event.error.code) : undefined;
  const state = event.milestone === "result_recovered_via_poll"
    ? "recovering"
    : event.milestone === "callback_verified" || event.milestone === "result_received_via_sse"
      ? "verifying"
      : event.milestone === "timed_out_pending"
        ? "interrupted"
        : event.milestone === "user_rejected"
          ? "interrupted"
          : event.snapshot.state === "recovering"
            ? "recovering"
            : event.snapshot.state === "registering"
              ? "preparing"
              : event.snapshot.state === "opening_wallet"
                ? "opening"
                : event.snapshot.state === "awaiting_approval"
                  ? "awaiting_approval"
                  : event.snapshot.state === "completed"
                    ? "verifying"
                    : "failed";
  return {
    ...correlation,
    state,
    ...(failureCode ? { failureCode } : {}),
    ...(event.milestone === "user_rejected" ? { failureCode: "wallet_rejected" } : {}),
    ...relayDiagnosticFields({
      error: event.error ?? event.snapshot.error,
      supportId: event.supportId,
      relayMilestone: event.milestone,
      pollAttempt: event.snapshot.pollAttempt,
      pollMaxAttempts: event.snapshot.pollMaxAttempts,
    }),
  };
}

/**
 * Register a single-use Relay v2 session before the user requests a Wallet action.
 *
 * `launchGlyphRequest()` opens a custom protocol through a synthetic anchor click,
 * which must remain in the initiating user interaction. Do not await relay I/O in
 * the click path. The callback write capability remains registered before it is
 * included in any Wallet request and the read capability remains dApp-only.
 */
function startRelaySessionPreparation(): Promise<void> {
  relaySessionPreparation = glyphRelayAdapter
    .prepare()
    .then((session) => {
      preparedRelaySession = session;
    })
    .finally(() => {
      relaySessionPreparation = null;
    });
  return relaySessionPreparation;
}

export function prewarmGlyphRelaySession(): Promise<void> {
  if (preparedRelaySession) return Promise.resolve();
  return relaySessionPreparation ?? startRelaySessionPreparation();
}

/**
 * Recovery-only preparation. A retry intentionally drops any unused local
 * session and registers another one. It never relaunches the old envelope.
 */
export function prepareFreshGlyphRelaySession(): Promise<void> {
  preparedRelaySession = null;
  if (!relaySessionPreparation) return startRelaySessionPreparation();
  return relaySessionPreparation.then(() => {
    preparedRelaySession = null;
    return startRelaySessionPreparation();
  });
}

/**
 * Bind relay preparation to a deliberate click on a Glyph request control.
 *
 * Preparing on hover, focus, or touch-start is intentionally avoided. Those
 * events are not consent to create a single-use session and can be triggered
 * accidentally. The click prepares only, and the next click launches after
 * registration has completed.
 */
export function createGlyphRequestIntentHandlers(onIntent: () => void | Promise<unknown>) {
  return {
    onClick: onIntent,
  };
}

/** @deprecated Use createGlyphRequestIntentHandlers for all Glyph requests. */
export const createGlyphConnectIntentHandlers = createGlyphRequestIntentHandlers;

export function isGlyphRelaySessionReady() {
  return preparedRelaySession !== null;
}

function takePreparedGlyphRelaySession() {
  if (!preparedRelaySession) {
    throw new GlyphRequestFailure("session_not_ready", REQUEST_NOT_READY_MESSAGE);
  }
  const session = preparedRelaySession;
  preparedRelaySession = null;
  return session;
}

function runGlyphOperation<Result>(requestType: GlyphRequestType, operation: () => Promise<Result>): Promise<Result> {
  const existing = inFlightGlyphRequests.get(requestType);
  if (existing) return existing as Promise<Result>;

  // Invoke synchronously. In particular, do not insert an await before
  // `relayAdapter.launch`, because the custom-protocol handoff must retain the
  // activating user gesture.
  const inFlight = operation();
  inFlightGlyphRequests.set(requestType, inFlight);
  const clearInFlight = () => {
    if (inFlightGlyphRequests.get(requestType) === inFlight) {
      inFlightGlyphRequests.delete(requestType);
    }
  };
  void inFlight.then(clearInFlight, clearInFlight);
  return inFlight;
}

async function requestFromGlyph(
  request: GlyphRequest,
  relayAdapter: GlyphRelayAdapter = glyphRelayAdapter,
): Promise<GlyphRequestExecution> {
  const correlation = nextRequestCorrelation(request);
  let prepared: GlyphPreparedRelaySession;
  try {
    prepared = takePreparedGlyphRelaySession();
  } catch (error) {
    const failureCode = classifyFailure(error);
    emitLifecycle(correlation, "failed", failureCode);
    throw error;
  }

  const envelope = createMainnetGlyphEnvelope(request, prepared.callbackUrl);
  let resultPromise: Promise<GlyphCallbackResponse>;
  let transportFailureReported = false;
  try {
    resultPromise = relayAdapter.subscribe(request, prepared, {
      requestHash: envelope.request_hash,
      // Connect 4.1 performs bounded /v2/result recovery after an interrupted
      // SSE stream. Keep enough attempts for rapid pending responses without
      // extending the UI's retryable failure window. A retry from this UI
      // still creates a new session/request.
      maxPollAttempts: GLYPH_RELAY_MAX_POLL_ATTEMPTS,
      pollTimeoutMs: GLYPH_RELAY_POLL_TIMEOUT_MS,
      pollIntervalMs: GLYPH_RELAY_POLL_INTERVAL_MS,
      recoveryTimeoutMs: GLYPH_RELAY_RECOVERY_TIMEOUT_MS,
      verification: {
        requireSigned: true,
        expectedRequestHash: envelope.request_hash,
        expectedNetwork: envelope.network,
        expectedDappOrigin: request.dapp.origin,
        expectedExp: request.exp ?? null,
        expectedCallbackUrl: prepared.callbackUrl,
        verifySignature: verifyWalletCallbackSignature,
      },
      onStatus(status) {
        if (status.state === "failed") transportFailureReported = true;
        rememberRelayDiagnostic(correlation, mapRelayStatus(correlation, status));
      },
      onEvent(event) {
        if (event.milestone === "failed") transportFailureReported = true;
        rememberRelayDiagnostic(correlation, mapRelayEvent(correlation, event));
      },
      onSnapshot(snapshot) {
        // Snapshots are the only hook that exposes bounded poll progress. Do
        // not mirror every initial snapshot because onEvent already carries
        // the same capability-free state transitions.
        if (snapshot.pollAttempt > 0 || snapshot.state === "recovering" || snapshot.state === "failed") {
          rememberRelayDiagnostic(correlation, mapRelaySnapshot(correlation, snapshot));
        }
      },
    });

    // This remains in the activating click path. Relay preparation happens
    // before the click, while subscription and launch stay synchronous here.
    relayAdapter.launch(envelope);
  } catch {
    const failure = new GlyphRequestFailure("launch_failed", failureMessage("launch_failed"));
    emitLifecycle(correlation, "failed", failure.code);
    throw failure;
  }

  try {
    const result = await resultPromise;
    window.focus();
    return { result, correlation };
  } catch (error) {
    const failureCode = classifyFailure(error);
    const failure = new GlyphRequestFailure(failureCode, failureMessage(failureCode));
    Object.assign(correlation, relayDiagnosticFields({
      error,
      supportId: safeRelaySupportId(error),
    }));
    if (!transportFailureReported) {
      emitLifecycle(
        correlation,
        isInterruptedFailure(failureCode) ? "interrupted" : "failed",
        failureCode,
      );
    }
    throw failure;
  }
}

function operationFailure(correlation: GlyphRequestCorrelation, code: GlyphFailureCode): never {
  emitLifecycle(correlation, isInterruptedFailure(code) ? "interrupted" : "failed", code);
  throw new GlyphRequestFailure(code, failureMessage(code));
}

function completeOperation(correlation: GlyphRequestCorrelation) {
  emitLifecycle(correlation, "completed");
}

/** Build the only envelope this dApp launches, with an explicit mainnet binding. */
export function createMainnetGlyphEnvelope(request: GlyphRequest, callback: string): GlyphEnvelope {
  return createEnvelope(request, {
    callback,
    network: GLYPH_MAINNET_NETWORK,
  });
}

type GlyphCallbackVerifierInput = {
  payload: Uint8Array;
  signature: Uint8Array;
  publicKey: Uint8Array;
  envelope?: GlyphSignedCallbackEnvelope;
};

function hasValidIdentity(value: unknown): value is Identity {
  if (typeof value !== "string") return false;
  try {
    identityToPublicKey(value as Identity);
    return true;
  } catch {
    return false;
  }
}

function sameBytes(left: Uint8Array, right: Uint8Array) {
  return left.byteLength === right.byteLength && left.every((byte, index) => byte === right[index]);
}

function assertValidIdentity(value: unknown): asserts value is Identity {
  if (!hasValidIdentity(value)) {
    throw new Error("Glyph Wallet returned an invalid identity.");
  }
}

/**
 * Verify the signed callback proof and bind its public key to the claimed
 * Qubic identity. The SDK already checks canonical payloads and request
 * bindings; this additional check prevents a valid signature from being
 * paired with a different identity claim.
 */
export function verifyWalletCallbackSignature(input: GlyphCallbackVerifierInput) {
  if (input.envelope) {
    try {
      const proofIdentity = input.envelope.proof.identity;
      if (!hasValidIdentity(proofIdentity)) return false;
      if (!sameBytes(identityToPublicKey(proofIdentity), input.publicKey)) return false;
      if (
        input.envelope.result.status !== "rejected" &&
        input.envelope.result.identity !== proofIdentity
      ) {
        return false;
      }
    } catch {
      return false;
    }
  }

  return verify(k12(input.payload, 32), input.signature, input.publicKey);
}

function saveAccount(account: WalletAccount | null) {
  if (typeof window === "undefined") return;
  if (account) localStorage.setItem(STORAGE_KEY, JSON.stringify(account));
  else localStorage.removeItem(STORAGE_KEY);
}

function isWalletAccount(value: unknown): value is WalletAccount {
  if (!value || typeof value !== "object") return false;
  const account = value as Partial<WalletAccount>;
  return hasValidIdentity(account.identity) && account.name === "Glyph Wallet";
}

function readAccount(): WalletAccount | null {
  if (typeof window === "undefined") return null;
  const value = localStorage.getItem(STORAGE_KEY);
  if (!value) return null;
  try {
    const account: unknown = JSON.parse(value);
    if (!isWalletAccount(account)) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return account;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function unsupported(): never {
  throw new Error(
    "Use the transfer or smart-contract request helpers from @glyph-oss/connect for Glyph Wallet transactions.",
  );
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fromHex(value: string) {
  const normalized = value.trim();
  if (!/^[0-9a-fA-F]+$/.test(normalized) || normalized.length % 2 !== 0) {
    throw new Error("Enter a complete hexadecimal signature.");
  }
  return Uint8Array.from(normalized.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16));
}

function bytesToBase64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(value: string) {
  try {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    if (bytes.byteLength === 0) throw new Error("empty binary response");
    return bytes;
  } catch {
    throw new Error("Glyph Wallet returned malformed binary response data.");
  }
}

function assertSameIdentity(actual: string, expected: string) {
  if (actual !== expected) {
    throw new Error("Glyph Wallet returned a response for a different identity.");
  }
}

function assertPermissionsGranted(granted: GlyphPermission[]) {
  const requested = new Set(permissions);
  const grantedSet = new Set(granted);
  if (grantedSet.size !== requested.size || [...grantedSet].some((permission) => !requested.has(permission))) {
    throw new Error("Glyph Wallet did not grant exactly the requested permissions.");
  }
}

/**
 * Build a typed, mainnet-bound smart-contract request for the connected account.
 *
 * Connect 4.1.0 validates the numeric bounds and request shape. It does not
 * define contract ABIs or payload semantics, so this adapter deliberately
 * accepts those values from the caller and passes `payload` through unchanged.
 * Construction alone does not open Glyph Wallet.
 *
 * Harmless shape-only example, not a request to launch:
 * ```ts
 * const example: GlyphScCallInput = { contractIndex: 0, inputType: 0, amount: "0" };
 * ```
 */
function createGlyphScCallRequestForAccount(input: GlyphScCallInput, account: WalletAccount): GlyphScCallRequest {
  return createScCallRequest({
    type: "sc_call",
    dapp: dapp(),
    from: account.identity,
    contract_index: input.contractIndex,
    input_type: input.inputType,
    ...(input.payload !== undefined ? { payload: input.payload } : {}),
    ...(input.amount !== undefined ? { amount: input.amount } : {}),
    ...(input.tickOffset !== undefined ? { tick_offset: input.tickOffset } : {}),
  });
}

export function createGlyphScCallRequest(input: GlyphScCallInput): GlyphScCallRequest {
  const account = readAccount();
  if (!account) throw new Error("Connect Glyph Wallet before requesting a smart-contract call.");
  return createGlyphScCallRequestForAccount(input, account);
}

function completeGlyphTransaction(
  { result, correlation }: GlyphRequestExecution,
  requestType: "transfer" | "sc_call",
  account: WalletAccount,
) {
  if (result.status === "rejected") return operationFailure(correlation, "wallet_rejected");
  if (result.status !== "signed" || result.type !== requestType) {
    return operationFailure(correlation, "invalid_response");
  }
  try {
    assertSameIdentity(result.identity, account.identity);
    assertValidIdentity(result.identity);
  } catch {
    return operationFailure(correlation, "verification_failed");
  }
  completeOperation(correlation);
  return { txId: result.tx_hash, targetTick: result.target_tick };
}

export function requestGlyphTransfer(destination: string, amount: string) {
  return runGlyphOperation("transfer", async () => {
    const account = readAccount();
    if (!account) throw new Error("Connect Glyph Wallet before requesting a transfer.");
    const execution = await requestFromGlyph(
      createTransferRequest({
        type: "transfer",
        dapp: dapp(),
        to: destination,
        amount,
        from: account.identity,
      }),
    );
    return completeGlyphTransaction(execution, "transfer", account);
  });
}

/** Request one caller-defined smart-contract action through signed Relay v2. */
export function requestGlyphScCall(input: GlyphScCallInput) {
  return runGlyphOperation("sc_call", async () => {
    const account = readAccount();
    if (!account) throw new Error("Connect Glyph Wallet before requesting a smart-contract call.");
    const execution = await requestFromGlyph(createGlyphScCallRequestForAccount(input, account));
    return completeGlyphTransaction(execution, "sc_call", account);
  });
}

export function requestGlyphVerification(message: string, signatureHex: string) {
  return runGlyphOperation("verify_message", async () => {
    const account = readAccount();
    if (!account) throw new Error("Connect Glyph Wallet before verifying a signature.");
    const execution = await requestFromGlyph(
      createVerifyMessageRequest({
        type: "verify_message",
        dapp: dapp(),
        message,
        signature: bytesToBase64(fromHex(signatureHex)),
        public_key: bytesToBase64(identityToPublicKey(account.identity)),
      }),
    );
    const { result, correlation } = execution;
    if (result.status === "rejected") return operationFailure(correlation, "wallet_rejected");
    if (result.status !== "verified") {
      return operationFailure(correlation, "invalid_response");
    }
    try {
      assertSameIdentity(result.identity, account.identity);
      assertValidIdentity(result.identity);
    } catch {
      return operationFailure(correlation, "verification_failed");
    }
    completeOperation(correlation);
    return result.valid;
  });
}

export const glyphConnector: WalletConnector = {
  id: "glyph-wallet",
  isAvailable: () => typeof window !== "undefined",
  connect() {
    return runGlyphOperation("connect", async () => {
      const execution = await requestFromGlyph(
        createConnectRequest({ type: "connect", dapp: dapp(), permissions }),
      );
      const { result, correlation } = execution;
      if (result.status === "rejected") return operationFailure(correlation, "wallet_rejected");
      if (result.status !== "connected") return operationFailure(correlation, "invalid_response");
      try {
        assertValidIdentity(result.identity);
        assertPermissionsGranted(result.permissions);
      } catch {
        return operationFailure(correlation, "verification_failed");
      }
      const account: WalletAccount = {
        identity: result.identity as Identity,
        name: "Glyph Wallet",
      };
      completeOperation(correlation);
      saveAccount(account);
      emit("accountChanged", account);
      return account;
    });
  },
  async getAccount() {
    return readAccount();
  },
  async disconnect() {
    saveAccount(null);
    emit("disconnect");
  },
  async sendTransaction() {
    return unsupported();
  },
  async signTransaction() {
    return unsupported();
  },
  signMessage(message: string): Promise<SignMessageResult> {
    return runGlyphOperation("sign_message", async () => {
      const account = readAccount();
      if (!account) throw new Error("Connect Glyph Wallet before signing a message.");
      const execution = await requestFromGlyph(
        createSignMessageRequest({
          type: "sign_message",
          dapp: dapp(),
          message,
          from: account.identity,
        }),
      );
      const { result, correlation } = execution;
      if (result.status === "rejected") return operationFailure(correlation, "wallet_rejected");
      if (result.status !== "signed" || result.type !== "sign_message") {
        return operationFailure(correlation, "invalid_response");
      }
      let signatureBytes: Uint8Array;
      try {
        assertSameIdentity(result.identity, account.identity);
        assertValidIdentity(result.identity);
      } catch {
        return operationFailure(correlation, "verification_failed");
      }
      try {
        signatureBytes = base64ToBytes(result.signature);
        if (signatureBytes.byteLength !== 64) {
          return operationFailure(correlation, "invalid_response");
        }
      } catch {
        return operationFailure(correlation, "invalid_response");
      }
      completeOperation(correlation);
      return {
        signatureHex: toHex(signatureBytes),
        digestHex: toHex(k12(new TextEncoder().encode(message), 32)),
      };
    });
  },
  on(event, callback) {
    const eventListeners = listeners.get(event) ?? new Set();
    eventListeners.add(callback);
    listeners.set(event, eventListeners);
    return () => eventListeners.delete(callback);
  },
};
