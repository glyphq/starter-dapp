import { describe, expect, mock, test } from "bun:test";

const lifecycleDetails: Array<{
  requestId: string;
  requestType: string;
  state: string;
  supportId?: string | null;
  relayMilestone?: string;
  relayErrorCode?: string;
  pollAttempt?: number;
  pollMaxAttempts?: number;
}> = [];
const events: string[] = [];

Object.assign(globalThis, {
  window: {
    dispatchEvent: (event: Event) => {
      lifecycleDetails.push((event as CustomEvent<(typeof lifecycleDetails)[number]>).detail);
      return true;
    },
    focus: () => undefined,
  },
  localStorage: { getItem: () => null, removeItem: () => undefined, setItem: () => undefined },
});

const preparedSession = {
  session: "session-12345678901234567890",
  callbackUrl: "https://relay.glyphq.org/v2/callback/session-12345678901234567890/c_1234567890123456789012",
  streamUrl: "https://relay.glyphq.org/v2/stream/session-12345678901234567890/r_1234567890123456789012",
  resultUrl: "https://relay.glyphq.org/v2/result/session-12345678901234567890/r_1234567890123456789012",
  registered: true,
};

const result = {
  status: "connected" as const,
  type: "connect" as const,
  nonce: "connect-nonce-1234",
  identity: "A".repeat(60),
  permissions: ["transfer", "sign_message"],
};

let subscribeOptions: Record<string, unknown> | undefined;

mock.module("@glyph-oss/connect", () => ({
  createConnectRequest: (request: Record<string, unknown>) => ({
    ...request,
    nonce: "connect-nonce-1234",
    exp: 2_000_000_000,
  }),
  createScCallRequest: () => { throw new Error("not used"); },
  createEnvelope: (request: Record<string, unknown>, options: Record<string, unknown>) => ({
    protocol: "glyph-connect-request/2",
    request,
    request_hash: "sha256:test",
    ...options,
  }),
  createSignMessageRequest: () => { throw new Error("not used"); },
  createTransferRequest: () => { throw new Error("not used"); },
  createVerifyMessageRequest: () => { throw new Error("not used"); },
  launchGlyphRequest: () => events.push("launch"),
  prepareRelaySession: () => {
    events.push("prepare");
    return Promise.resolve(preparedSession);
  },
  subscribeViaRelayV2: (_request: unknown, _session: typeof preparedSession, options: Record<string, unknown>) => {
    events.push("subscribe");
    subscribeOptions = options;
    const onStatus = options.onStatus as ((status: unknown) => void) | undefined;
    const onSnapshot = options.onSnapshot as ((snapshot: unknown) => void) | undefined;
    const onEvent = options.onEvent as ((event: unknown) => void) | undefined;
    onStatus?.({ state: "opening_wallet" });
    onEvent?.({
      version: "glyph-relay-event/1",
      milestone: "stream_opened",
      at: 1,
      supportId: "support-1234",
      snapshot: {
        version: "glyph-relay-snapshot/1",
        state: "awaiting_approval",
        milestone: "stream_opened",
        supportId: "support-1234",
        pollAttempt: 0,
        pollMaxAttempts: 12,
        error: null,
      },
    });
    onStatus?.({ state: "awaiting_approval" });
    onSnapshot?.({
      version: "glyph-relay-snapshot/1",
      state: "recovering",
      milestone: "result_recovered_via_poll",
      supportId: "support-1234",
      pollAttempt: 1,
      pollMaxAttempts: 12,
      error: null,
    });
    onEvent?.({
      version: "glyph-relay-event/1",
      milestone: "result_recovered_via_poll",
      at: 2,
      supportId: "support-1234",
      snapshot: {
        version: "glyph-relay-snapshot/1",
        state: "recovering",
        milestone: "result_recovered_via_poll",
        supportId: "support-1234",
        pollAttempt: 1,
        pollMaxAttempts: 12,
        error: null,
      },
    });
    onEvent?.({
      version: "glyph-relay-event/1",
      milestone: "callback_verified",
      at: 3,
      supportId: "support-1234",
      snapshot: {
        version: "glyph-relay-snapshot/1",
        state: "completed",
        milestone: "callback_verified",
        supportId: "support-1234",
        pollAttempt: 1,
        pollMaxAttempts: 12,
        error: null,
      },
    });
    onStatus?.({ state: "completed", result });
    return Promise.resolve(result);
  },
}));

mock.module("@qubic.org/crypto", () => ({
  identityToPublicKey: () => new Uint8Array(),
  k12: () => new Uint8Array(),
  verify: () => true,
}));

const {
  buildGlyphSafeDiagnostic,
  glyphConnector,
  prewarmGlyphRelaySession,
} = await import("./glyph");

describe("Glyph Connect 4.1 relay lifecycle integration", () => {
  test("propagates event diagnostics, bounded poll recovery, and the recovered result state", async () => {
    await prewarmGlyphRelaySession();
    await expect(glyphConnector.connect()).resolves.toMatchObject({ identity: result.identity });

    expect(events).toEqual(["prepare", "subscribe", "launch"]);
    expect(subscribeOptions?.requestHash).toBe("sha256:test");
    expect(subscribeOptions?.maxPollAttempts).toBe(12);
    expect(subscribeOptions?.pollTimeoutMs).toBe(2_000);
    expect(subscribeOptions?.pollIntervalMs).toBe(250);
    expect(subscribeOptions?.recoveryTimeoutMs).toBe(3_500);
    expect((subscribeOptions?.verification as { requireSigned: boolean }).requireSigned).toBe(true);

    expect(lifecycleDetails.some((detail) => detail.state === "recovering")).toBe(true);
    expect(lifecycleDetails.some((detail) => detail.relayMilestone === "result_recovered_via_poll")).toBe(true);
    expect(lifecycleDetails.at(-1)).toMatchObject({
      state: "completed",
      supportId: "support-1234",
      pollAttempt: 1,
      pollMaxAttempts: 12,
    });
  });

  test("redacts protocol secrets and raw relay errors from copied diagnostics", () => {
    const diagnostic = buildGlyphSafeDiagnostic({
      requestId: "local-1",
      requestType: "transfer",
      state: "interrupted",
      failureCode: "relay_timeout",
      relayErrorCode: "poll_exhausted",
      relayMilestone: "timed_out_pending",
      supportId: "support-1234",
      pollAttempt: 3,
      pollMaxAttempts: 12,
    });

    expect(JSON.parse(diagnostic)).toEqual({
      schema: "glyph-starter-diagnostic/v1",
      connector: "glyph-wallet",
      protocol: "connect-v2",
      network: "qubic:mainnet",
      request_type: "transfer",
      milestone: "interrupted",
      failure_code: "relay_timeout",
      relay_error_code: "poll_exhausted",
      support_id: "support-1234",
      poll_attempt: 3,
      poll_max_attempts: 12,
      retry_available: true,
    });
    expect(diagnostic).not.toContain("callbackUrl");
    expect(diagnostic).not.toContain("streamUrl");
    expect(diagnostic).not.toContain("signed_payload");
    expect(diagnostic).not.toContain("callback_capability");
    expect(diagnostic).not.toContain("raw relay secret");
  });
});
