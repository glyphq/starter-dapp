import { describe, expect, mock, test } from "bun:test";

const identities = "A".repeat(60);
const sessions = [
  {
    session: "session-first-123456789012345",
    callbackUrl: "https://relay.glyphq.org/v2/callback/session-first-123456789012345/c_1234567890123456789012",
    streamUrl: "https://relay.glyphq.org/v2/stream/session-first-123456789012345/r_1234567890123456789012",
    resultUrl: "https://relay.glyphq.org/v2/result/session-first-123456789012345/r_1234567890123456789012",
    registered: true,
  },
  {
    session: "session-second-12345678901234",
    callbackUrl: "https://relay.glyphq.org/v2/callback/session-second-12345678901234/c_2234567890123456789012",
    streamUrl: "https://relay.glyphq.org/v2/stream/session-second-12345678901234/r_2234567890123456789012",
    resultUrl: "https://relay.glyphq.org/v2/result/session-second-12345678901234/r_2234567890123456789012",
    registered: true,
  },
];
const events: string[] = [];
let prepareCount = 0;
let subscribeCount = 0;
const requests: Array<{ nonce: string; callback: string }> = [];

const { canonicalDappOrigin } = await import("@glyph-oss/connect");

Object.assign(globalThis, {
  window: {
    location: { origin: "https://dapp.example" }, dispatchEvent: () => true, focus: () => undefined },
  localStorage: { getItem: () => null, removeItem: () => undefined, setItem: () => undefined },
});

mock.module("@glyph-oss/connect", () => ({
  canonicalDappOrigin,
  createConnectRequest: (request: Record<string, unknown>) => ({
    ...request,
    nonce: `connect-nonce-${prepareCount + 1}`,
    exp: 2_000_000_000,
  }),
  createScCallRequest: () => { throw new Error("not used"); },
  createEnvelope: (request: { nonce: string }, options: { callback: string }) => ({
    protocol: "glyph-connect-request/2",
    request,
    request_hash: `sha256:${request.nonce}`,
    ...options,
  }),
  createSignMessageRequest: () => { throw new Error("not used"); },
  createTransferRequest: () => { throw new Error("not used"); },
  createVerifyMessageRequest: () => { throw new Error("not used"); },
  launchGlyphRequest: () => events.push("launch"),
  prepareRelaySession: () => {
    const session = sessions[prepareCount];
    prepareCount += 1;
    events.push(`prepare:${session.session}`);
    return Promise.resolve(session);
  },
  subscribeViaRelayV2: (request: { nonce: string }, session: typeof sessions[number]) => {
    subscribeCount += 1;
    requests.push({ nonce: request.nonce, callback: session.callbackUrl });
    events.push(`subscribe:${session.session}`);
    if (subscribeCount === 1) {
      return Promise.reject({ code: "stream_timeout", supportId: "support-first" });
    }
    return Promise.resolve({
      status: "connected",
      type: "connect",
      nonce: request.nonce,
      identity: identities,
      permissions: ["transfer", "sc_call", "sign_message"],
    });
  },
}));

mock.module("@qubic.org/crypto", () => ({
  identityToPublicKey: () => new Uint8Array(),
  k12: () => new Uint8Array(),
  verify: () => true,
}));

const {
  glyphConnector,
  prepareFreshGlyphRelaySession,
  prewarmGlyphRelaySession,
} = await import("./glyph");

describe("Glyph callback recovery retry", () => {
  test("uses a fresh session and request after bounded recovery fails", async () => {
    await prewarmGlyphRelaySession();
    await expect(glyphConnector.connect()).rejects.toThrow("approval window expired");

    await prepareFreshGlyphRelaySession();
    await expect(glyphConnector.connect()).resolves.toMatchObject({ identity: identities });

    expect(prepareCount).toBe(2);
    expect(subscribeCount).toBe(2);
    expect(requests[0]).toEqual({
      nonce: "connect-nonce-2",
      callback: sessions[0].callbackUrl,
    });
    expect(requests[1]).toEqual({
      nonce: "connect-nonce-3",
      callback: sessions[1].callbackUrl,
    });
    expect(requests[0].nonce).not.toBe(requests[1].nonce);
    expect(requests[0].callback).not.toBe(requests[1].callback);
    expect(events).toEqual([
      `prepare:${sessions[0].session}`,
      `subscribe:${sessions[0].session}`,
      "launch",
      `prepare:${sessions[1].session}`,
      `subscribe:${sessions[1].session}`,
      "launch",
    ]);
  });
});
