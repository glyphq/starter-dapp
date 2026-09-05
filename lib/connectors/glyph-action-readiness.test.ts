import { beforeEach, describe, expect, mock, test } from "bun:test";

const events: string[] = [];
let resultOverride: Record<string, unknown> | null = null;
const identity = "A".repeat(60);
const preparedSession = {
  session: "session-action-123456789012345",
  callbackUrl: "https://relay.glyphq.org/v2/callback/session-action-123456789012345/c_1234567890123456789012",
  streamUrl: "https://relay.glyphq.org/v2/stream/session-action-123456789012345/r_1234567890123456789012",
  resultUrl: "https://relay.glyphq.org/v2/result/session-action-123456789012345/r_1234567890123456789012",
  registered: true,
};

type Preparation = {
  promise: Promise<typeof preparedSession>;
  resolve: (value: typeof preparedSession) => void;
  reject: (reason?: unknown) => void;
};

let nextPreparation!: Preparation;
let localStorageValue = JSON.stringify({ identity, name: "Glyph Wallet" });

function createPreparation(): Preparation {
  let resolve!: Preparation["resolve"];
  let reject!: Preparation["reject"];
  const promise = new Promise<typeof preparedSession>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const { canonicalDappOrigin } = await import("@glyph-oss/connect");

Object.assign(globalThis, {
  window: {
    location: { origin: "https://dapp.example" }, dispatchEvent: () => true, focus: () => undefined },
  localStorage: {
    getItem: () => localStorageValue,
    removeItem: () => { localStorageValue = null as unknown as string; },
    setItem: (_key: string, value: string) => { localStorageValue = value; },
  },
});

mock.module("@glyph-oss/connect", () => ({
  canonicalDappOrigin,
  createConnectRequest: (request: Record<string, unknown>) => ({ ...request, nonce: "connect-nonce", exp: 2_000_000_000 }),
  createScCallRequest: (request: Record<string, unknown>) => ({ ...request, nonce: "sc-call-nonce", exp: 2_000_000_000 }),
  createSignMessageRequest: (request: Record<string, unknown>) => ({ ...request, nonce: "sign-nonce", exp: 2_000_000_000 }),
  createTransferRequest: (request: Record<string, unknown>) => ({ ...request, nonce: "transfer-nonce", exp: 2_000_000_000 }),
  createVerifyMessageRequest: (request: Record<string, unknown>) => ({ ...request, nonce: "verify-nonce", exp: 2_000_000_000 }),
  createEnvelope: (request: Record<string, unknown>, options: Record<string, unknown>) => ({
    protocol: "glyph-connect-request/2",
    request,
    request_hash: `sha256:${String(request.type)}`,
    ...options,
  }),
  launchGlyphRequest: (envelope: { request: { type: string } }) => events.push(`launch:${envelope.request.type}`),
  prepareRelaySession: () => {
    events.push("prepare");
    nextPreparation = createPreparation();
    return nextPreparation.promise;
  },
  subscribeViaRelayV2: (request: { type: string }, session: typeof preparedSession) => {
    expect(session.registered).toBe(true);
    events.push(`subscribe:${request.type}`);
    if (resultOverride) return Promise.resolve(resultOverride);
    if (request.type === "sign_message") {
      return Promise.resolve({
        status: "signed",
        type: "sign_message",
        nonce: "sign-nonce",
        identity,
        signature: "AQI=",
      });
    }
    if (request.type === "transfer") {
      return Promise.resolve({
        status: "signed",
        type: "transfer",
        nonce: "transfer-nonce",
        identity,
        tx_hash: "tx-action-123",
        target_tick: 123,
      });
    }
    if (request.type === "sc_call") {
      return Promise.resolve({
        status: "signed",
        type: "sc_call",
        nonce: "sc-call-nonce",
        identity,
        tx_hash: "tx-sc-call-123",
        target_tick: 456,
      });
    }
    return Promise.resolve({
      status: "verified",
      type: "verify_message",
      nonce: "verify-nonce",
      identity,
      valid: true,
    });
  },
}));

mock.module("@qubic.org/crypto", () => ({
  identityToPublicKey: () => new Uint8Array([1, 2, 3]),
  k12: () => new Uint8Array([4, 5, 6]),
  verify: () => true,
}));

const {
  createGlyphRequestIntentHandlers,
  glyphConnector,
  isGlyphRelaySessionReady,
  prepareFreshGlyphRelaySession,
  prewarmGlyphRelaySession,
  requestGlyphScCall,
  requestGlyphTransfer,
  requestGlyphVerification,
} = await import("./glyph");

describe("Glyph action relay readiness", () => {
  beforeEach(() => {
    events.length = 0;
    resultOverride = null;
    localStorageValue = JSON.stringify({ identity, name: "Glyph Wallet" });
  });

  test("handles failed fresh preparation and allows the next deliberate retry", async () => {
    const preparing = prepareFreshGlyphRelaySession();
    nextPreparation.reject(new Error("relay unavailable"));
    await expect(preparing).rejects.toThrow("relay unavailable");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(isGlyphRelaySessionReady()).toBe(false);

    const retry = prewarmGlyphRelaySession();
    nextPreparation.resolve(preparedSession);
    await retry;
    expect(isGlyphRelaySessionReady()).toBe(true);
    await glyphConnector.signMessage("Consume the retry session");
  });

  test("prepares Sign and Verify from deliberate action clicks before synchronous launch", async () => {
    const signIntent = createGlyphRequestIntentHandlers(prewarmGlyphRelaySession);
    const signWarming = signIntent.onClick();

    expect(events).toEqual(["prepare"]);
    await expect(glyphConnector.signMessage("Sign this message")).rejects.toThrow("preparing a secure relay session");
    expect(events).toEqual(["prepare"]);

    nextPreparation.resolve(preparedSession);
    await signWarming;
    expect(isGlyphRelaySessionReady()).toBe(true);

    const signing = glyphConnector.signMessage("Sign this message");
    expect(events).toEqual(["prepare", "subscribe:sign_message", "launch:sign_message"]);
    await expect(signing).resolves.toMatchObject({ signatureHex: "0102" });

    const verifyIntent = createGlyphRequestIntentHandlers(prewarmGlyphRelaySession);
    const verifyWarming = verifyIntent.onClick();
    expect(events).toEqual(["prepare", "subscribe:sign_message", "launch:sign_message", "prepare"]);
    nextPreparation.resolve(preparedSession);
    await verifyWarming;

    const verification = requestGlyphVerification("Sign this message", "0102");
    expect(events).toEqual([
      "prepare",
      "subscribe:sign_message",
      "launch:sign_message",
      "prepare",
      "subscribe:verify_message",
      "launch:verify_message",
    ]);
    await expect(verification).resolves.toBe(true);
  });

  test("allows a failed preparation to be retried from the next deliberate intent", async () => {
    const firstAttempt = prewarmGlyphRelaySession();
    expect(events).toEqual(["prepare"]);
    nextPreparation.reject(new Error("relay unavailable"));
    await expect(firstAttempt).rejects.toThrow("relay unavailable");
    expect(isGlyphRelaySessionReady()).toBe(false);

    const retryIntent = createGlyphRequestIntentHandlers(prewarmGlyphRelaySession);
    const retryAttempt = retryIntent.onClick();
    expect(events).toEqual(["prepare", "prepare"]);
    nextPreparation.resolve(preparedSession);
    await retryAttempt;
    expect(isGlyphRelaySessionReady()).toBe(true);

    await expect(glyphConnector.signMessage("Retry this message")).resolves.toMatchObject({ signatureHex: "0102" });
    expect(events).toEqual(["prepare", "prepare", "subscribe:sign_message", "launch:sign_message"]);
  });

  test("uses the same deliberate preparation gate for transfers", async () => {
    const transferIntent = createGlyphRequestIntentHandlers(prewarmGlyphRelaySession);
    const warming = transferIntent.onClick();

    await expect(requestGlyphTransfer(identity, "1")).rejects.toThrow("preparing a secure relay session");
    nextPreparation.resolve(preparedSession);
    await warming;

    await expect(requestGlyphTransfer(identity, "1")).resolves.toMatchObject({ txId: "tx-action-123" });
    expect(events).toEqual(["prepare", "subscribe:transfer", "launch:transfer"]);
  });

  test("uses the same typed request path for caller-defined smart-contract calls", async () => {
    const callIntent = createGlyphRequestIntentHandlers(prewarmGlyphRelaySession);
    const warming = callIntent.onClick();

    await expect(requestGlyphScCall({
      contractIndex: 0,
      inputType: 0,
      amount: "0",
    })).rejects.toThrow("preparing a secure relay session");
    nextPreparation.resolve(preparedSession);
    await warming;

    await expect(requestGlyphScCall({
      contractIndex: 0,
      inputType: 0,
      amount: "0",
    })).resolves.toEqual({ txId: "tx-sc-call-123", targetTick: 456 });
    expect(events).toEqual(["prepare", "subscribe:sc_call", "launch:sc_call"]);
  });

  for (const requestType of ["transfer", "sc_call"] as const) {
    test.each([
      { status: "rejected", type: requestType, identity },
      { status: "connected", type: requestType, identity },
      { status: "signed", type: requestType === "transfer" ? "sc_call" : "transfer", identity },
      { status: "signed", type: requestType, identity: "B".repeat(60) },
    ])(`${requestType} rejects an invalid or rejected transaction result: %j`, async (result) => {
      const preparing = prewarmGlyphRelaySession();
      nextPreparation.resolve(preparedSession);
      await preparing;
      resultOverride = { ...result, tx_hash: "untrusted-tx", target_tick: 123 };
      const operation = requestType === "transfer"
        ? requestGlyphTransfer(identity, "1")
        : requestGlyphScCall({ contractIndex: 16, inputType: 1, amount: "1" });
      await expect(operation).rejects.toThrow();
      expect(isGlyphRelaySessionReady()).toBe(false);
    });
  }

});
