import { describe, expect, mock, test } from "bun:test";

const lifecycle: Array<{ state: string; failureCode?: string }> = [];
const preparedSession = {
  session: "session-cancel-123456789012345",
  callbackUrl: "https://relay.glyphq.org/v2/callback/session-cancel-123456789012345/c_1234567890123456789012",
  streamUrl: "https://relay.glyphq.org/v2/stream/session-cancel-123456789012345/r_1234567890123456789012",
  resultUrl: "https://relay.glyphq.org/v2/result/session-cancel-123456789012345/r_1234567890123456789012",
  registered: true,
};

const { canonicalDappOrigin } = await import("@glyph-oss/connect");

Object.assign(globalThis, {
  window: {
    location: { origin: "https://dapp.example" },
    dispatchEvent: (event: Event) => {
      lifecycle.push((event as CustomEvent<{ state: string; failureCode?: string }>).detail);
      return true;
    },
    focus: () => undefined,
  },
  localStorage: { getItem: () => null, removeItem: () => undefined, setItem: () => undefined },
});

const rejected = {
  status: "rejected" as const,
  type: "connect" as const,
  nonce: "cancel-nonce-123456",
  reason: "user_rejected" as const,
};

mock.module("@glyph-oss/connect", () => ({
  canonicalDappOrigin,
  createConnectRequest: (request: Record<string, unknown>) => ({
    ...request,
    nonce: rejected.nonce,
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
  launchGlyphRequest: () => undefined,
  prepareRelaySession: () => Promise.resolve(preparedSession),
  subscribeViaRelayV2: (_request: unknown, _session: unknown, options: Record<string, unknown>) => {
    (options.onStatus as ((status: unknown) => void) | undefined)?.({ state: "opening_wallet" });
    (options.onStatus as ((status: unknown) => void) | undefined)?.({ state: "awaiting_approval" });
    (options.onEvent as ((event: unknown) => void) | undefined)?.({
      version: "glyph-relay-event/1",
      milestone: "user_rejected",
      at: 1,
      supportId: "support-cancel",
      snapshot: {
        version: "glyph-relay-snapshot/1",
        state: "completed",
        milestone: "user_rejected",
        supportId: "support-cancel",
        pollAttempt: 0,
        pollMaxAttempts: 12,
        error: null,
      },
    });
    (options.onStatus as ((status: unknown) => void) | undefined)?.({ state: "completed", result: rejected });
    return Promise.resolve(rejected);
  },
}));

mock.module("@qubic.org/crypto", () => ({
  identityToPublicKey: () => new Uint8Array(),
  k12: () => new Uint8Array(),
  verify: () => true,
}));

const { glyphConnector, prewarmGlyphRelaySession } = await import("./glyph");

describe("Glyph normal cancellation handling", () => {
  test("surfaces wallet rejection as an interrupted, retryable UI state", async () => {
    await prewarmGlyphRelaySession();
    await expect(glyphConnector.connect()).rejects.toThrow("request was rejected");

    expect(lifecycle.at(-1)).toMatchObject({
      requestId: expect.any(String),
      requestType: "connect",
      state: "interrupted",
      failureCode: "wallet_rejected",
    });
    expect(lifecycle.some((detail) => detail.state === "failed" && detail.failureCode === "wallet_rejected")).toBe(false);
  });
});
