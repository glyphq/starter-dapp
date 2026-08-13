import { describe, expect, mock, test } from "bun:test";

Object.assign(globalThis, {
  window: {
    dispatchEvent: (event: Event) => {
      lifecycleDetails.push((event as CustomEvent<{ requestId: string; requestType: string; state: string }>).detail);
      return true;
    },
    focus: () => undefined,
  },
  localStorage: { getItem: () => null, removeItem: () => undefined, setItem: () => undefined },
});

const events: string[] = [];
const lifecycleDetails: Array<{ requestId: string; requestType: string; state: string }> = [];
const preparedSession = {
  session: "session-12345678901234567890",
  callbackUrl: "https://relay.glyphq.org/v2/callback/session-12345678901234567890/c_1234567890123456789012",
  streamUrl: "https://relay.glyphq.org/v2/stream/session-12345678901234567890/r_1234567890123456789012",
  resultUrl: "https://relay.glyphq.org/v2/result/session-12345678901234567890/r_1234567890123456789012",
  registered: true,
};
let resolvePreparation!: (value: typeof preparedSession) => void;
let resolveResult!: (value: { status: "connected"; type: "connect"; nonce: string; identity: string; permissions: string[] }) => void;
const preparation = new Promise<typeof preparedSession>((resolve) => {
  resolvePreparation = resolve;
});
const result = new Promise<{ status: "connected"; type: "connect"; nonce: string; identity: string; permissions: string[] }>((resolve) => {
  resolveResult = resolve;
});
let subscribedSession: typeof preparedSession | undefined;

mock.module("@glyph-oss/connect", () => ({
  createConnectRequest: (request: Record<string, unknown>) => ({ ...request, nonce: "connect-nonce-1234", exp: 2_000_000_000 }),
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
    return preparation;
  },
  subscribeViaRelayV2: (_request: unknown, session: typeof preparedSession, options?: { onStatus?: (status: unknown) => void }) => {
    events.push("subscribe");
    subscribedSession = session;
    options?.onStatus?.({ state: "opening_wallet" });
    options?.onStatus?.({ state: "awaiting_approval" });
    options?.onStatus?.({ state: "completed", result: {} });
    return result;
  },
}));

mock.module("@qubic.org/crypto", () => ({
  identityToPublicKey: () => new Uint8Array(),
  k12: () => new Uint8Array(),
  verify: () => true,
}));

const {
  createGlyphRequestIntentHandlers,
  glyphConnector,
  isGlyphRelaySessionReady,
  prewarmGlyphRelaySession,
} = await import("./glyph");

describe("Glyph secure relay launch", () => {
  test("prepares only after a deliberate Connect click and launches on the next click", async () => {
    expect(events).toEqual([]);
    lifecycleDetails.length = 0;
    const intents = createGlyphRequestIntentHandlers(prewarmGlyphRelaySession);
    const warming = intents.onClick();
    expect(events).toEqual(["prepare"]);
    expect(isGlyphRelaySessionReady()).toBe(false);

    await expect(glyphConnector.connect()).rejects.toThrow("preparing a secure relay session");
    expect(events).toEqual(["prepare"]);
    lifecycleDetails.length = 0;

    resolvePreparation(preparedSession);
    await warming;
    expect(isGlyphRelaySessionReady()).toBe(true);

    const connecting = glyphConnector.connect();
    expect(events).toEqual(["prepare", "subscribe", "launch"]);
    expect(subscribedSession).toEqual(preparedSession);
    expect(subscribedSession?.registered).toBe(true);
    expect(isGlyphRelaySessionReady()).toBe(false);

    const repeated = glyphConnector.connect();
    expect(events).toEqual(["prepare", "subscribe", "launch"]);

    resolveResult({
      status: "connected",
      type: "connect",
      nonce: "connect-nonce-1234",
      identity: "A".repeat(60),
      permissions: ["transfer", "sc_call", "sign_message"],
    });
    await expect(connecting).resolves.toMatchObject({ identity: "A".repeat(60) });
    await expect(repeated).resolves.toMatchObject({ identity: "A".repeat(60) });
    expect(lifecycleDetails.map((detail) => detail.state)).toEqual([
      "opening",
      "awaiting_approval",
      "verifying",
      "completed",
    ]);
    expect(lifecycleDetails.every((detail) => detail.requestId === "local-2")).toBe(true);
  });
});
