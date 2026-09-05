import { beforeEach, describe, expect, mock, test } from "bun:test";

const identity = "A".repeat(60);
const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(64).fill(1)));
const signatureHex = "01".repeat(64);
const launches: string[] = [];
let resolveCallback!: (value: Record<string, unknown>) => void;
let callback: Promise<Record<string, unknown>>;

const preparedSession = {
  session: "session-idempotency-1234567890123",
  callbackUrl: "https://relay.glyphq.org/v2/callback/session-idempotency-1234567890123/c_1234567890123456789012",
  streamUrl: "https://relay.glyphq.org/v2/stream/session-idempotency-1234567890123/r_1234567890123456789012",
  resultUrl: "https://relay.glyphq.org/v2/result/session-idempotency-1234567890123/r_1234567890123456789012",
  registered: true,
};

function pendingCallback() {
  callback = new Promise((resolve) => {
    resolveCallback = resolve;
  });
}

const { canonicalDappOrigin } = await import("@glyph-oss/connect");

Object.assign(globalThis, {
  window: {
    location: { origin: "https://dapp.example" }, dispatchEvent: () => true, focus: () => undefined },
  localStorage: {
    getItem: () => JSON.stringify({ identity, name: "Glyph Wallet" }),
    removeItem: () => undefined,
    setItem: () => undefined,
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
  launchGlyphRequest: (envelope: { request: { type: string } }) => launches.push(envelope.request.type),
  prepareRelaySession: () => Promise.resolve(preparedSession),
  subscribeViaRelayV2: () => callback,
}));

mock.module("@qubic.org/crypto", () => ({
  identityToPublicKey: () => new Uint8Array([1, 2, 3]),
  k12: () => new Uint8Array([4, 5, 6]),
  verify: () => true,
}));

const {
  glyphConnector,
  prewarmGlyphRelaySession,
  requestGlyphScCall,
  requestGlyphVerification,
} = await import("./glyph");

async function prepareForAction() {
  pendingCallback();
  await prewarmGlyphRelaySession();
}

describe("Glyph signed request single-flight launches", () => {
  beforeEach(() => {
    launches.length = 0;
  });

  test("connect launches one envelope when its handler is invoked twice", async () => {
    await prepareForAction();

    const first = glyphConnector.connect();
    const repeated = glyphConnector.connect();

    expect(launches).toEqual(["connect"]);
    resolveCallback({
      status: "connected",
      type: "connect",
      nonce: "connect-nonce",
      identity,
      permissions: ["transfer", "sc_call", "sign_message"],
    });
    await expect(first).resolves.toMatchObject({ identity });
    await expect(repeated).resolves.toMatchObject({ identity });
  });

  test("sc_call launches one envelope for rapid repeated submits", async () => {
    await prepareForAction();
    const input = { contractIndex: 15, inputType: 1, amount: "1" };

    const first = requestGlyphScCall(input);
    const repeated = requestGlyphScCall(input);

    expect(launches).toEqual(["sc_call"]);
    resolveCallback({
      status: "signed",
      type: "sc_call",
      nonce: "sc-call-nonce",
      identity,
      tx_hash: "sc-call-idempotency",
      target_tick: 123,
    });
    await expect(first).resolves.toEqual({ txId: "sc-call-idempotency", targetTick: 123 });
    await expect(repeated).resolves.toEqual({ txId: "sc-call-idempotency", targetTick: 123 });
  });

  test("sign launches one envelope when its handler is invoked twice", async () => {
    await prepareForAction();

    const first = glyphConnector.signMessage("Sign once");
    const repeated = glyphConnector.signMessage("Sign once");

    expect(launches).toEqual(["sign_message"]);
    resolveCallback({
      status: "signed",
      type: "sign_message",
      nonce: "sign-nonce",
      identity,
      signature: signatureBase64,
    });
    await expect(first).resolves.toMatchObject({ signatureHex });
    await expect(repeated).resolves.toMatchObject({ signatureHex });
  });

  test("verify launches one envelope for rapid repeated submits", async () => {
    await prepareForAction();

    const first = requestGlyphVerification("Verify once", "0102");
    const repeated = requestGlyphVerification("Verify once", "0102");

    expect(launches).toEqual(["verify_message"]);
    resolveCallback({
      status: "verified",
      type: "verify_message",
      nonce: "verify-nonce",
      identity,
      valid: true,
    });
    await expect(first).resolves.toBe(true);
    await expect(repeated).resolves.toBe(true);
  });
});
