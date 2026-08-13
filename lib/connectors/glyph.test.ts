import { describe, expect, test } from "bun:test";
import {
  GLYPH_CALLBACK_ENVELOPE_VERSION,
  GLYPH_CALLBACK_SIGNATURE_ALGORITHM,
  buildGlyphUrl,
  canonicalDappOrigin,
  canonicalJson,
  computeRequestHash,
  createConnectRequest,
  createScCallRequest,
  createSignMessageRequest,
  createTransferRequest,
  createVerifyMessageRequest,
  sha256Base64UrlSync,
  sha256CanonicalJson,
  verifyCallbackEnvelope,
  type GlyphCallbackResponse,
  type GlyphCallbackSignaturePayload,
  type GlyphRequest,
  type GlyphSignedCallbackEnvelope,
} from "@glyph-oss/connect";
import { generateRandomSeed, k12, publicKeyFromSeed, publicKeyToIdentity, sign } from "@qubic.org/crypto";
import {
  buildGlyphSafeDiagnostic,
  createMainnetGlyphEnvelope,
  GLYPH_MAINNET_NETWORK,
  isGlyphRequestRetryable,
  verifyWalletCallbackSignature,
} from "./glyph";

const DAPP_ORIGIN = "https://starter.glyphq.org";
const CALLBACK_URL = "https://relay.glyphq.org/v2/callback/session-id-123456789012/c_1234567890123456789012";
const FUTURE_EXP = Math.floor(Date.now() / 1_000) + 300;
const IDENTITY = "A".repeat(60);

function bytesToBase64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64");
}

/** Mirror the Wallet relay binding, which redacts the callback write capability. */
function walletSanitizedRelayCallbackUrl(callbackUrl: string) {
  const url = new URL(callbackUrl);
  const [, v2, callback, session, callbackCapability] = url.pathname.split("/");
  expect([v2, callback]).toEqual(["v2", "callback"]);
  expect(session).toBeTruthy();
  expect(callbackCapability).toBeTruthy();
  return `${url.origin}/v2/callback/${session}/${sha256Base64UrlSync(callbackCapability!)}`;
}

function defaultResult(): GlyphCallbackResponse {
  return {
    status: "connected",
    type: "connect",
    nonce: "nonce-test-123456",
    identity: IDENTITY,
    permissions: ["transfer", "sc_call", "sign_message"],
  };
}

async function createSignedEnvelope(
  result: GlyphCallbackResponse = defaultResult(),
  overrides: Partial<GlyphCallbackSignaturePayload> = {},
) {
  const seed = generateRandomSeed();
  const publicKey = publicKeyFromSeed(seed);
  const walletIdentity = publicKeyToIdentity(publicKey);
  const signedResult = result.status === "rejected" ? result : { ...result, identity: walletIdentity };
  const request = signedResult.type === "sign_message"
    ? createSignMessageRequest({
        type: "sign_message",
        dapp: { name: "Glyph Qubic Starter", origin: DAPP_ORIGIN },
        message: "Glyph Connect v4",
        from: IDENTITY,
      }, { nonce: signedResult.nonce, exp: FUTURE_EXP })
    : createConnectRequest({
        type: "connect",
        dapp: { name: "Glyph Qubic Starter", origin: DAPP_ORIGIN },
        permissions: ["transfer", "sc_call", "sign_message"],
      }, { nonce: signedResult.nonce, exp: FUTURE_EXP });
  const requestEnvelope = createMainnetGlyphEnvelope(request, CALLBACK_URL);
  const payload: GlyphCallbackSignaturePayload = {
    version: GLYPH_CALLBACK_ENVELOPE_VERSION,
    request_hash: requestEnvelope.request_hash,
    network: requestEnvelope.network,
    nonce: signedResult.nonce,
    dapp_origin: canonicalDappOrigin(DAPP_ORIGIN),
    request_type: signedResult.type,
    exp: request.exp ?? null,
    issued_at: 1_234_567_800,
    result_hash: sha256CanonicalJson(signedResult),
    relay: {
      // Wallet signs the canonical binding without exposing the callback write capability.
      callback_url: walletSanitizedRelayCallbackUrl(CALLBACK_URL),
      official_relay: true,
      route: "v2_session_callback",
      v1_nonce: null,
      session_id: "session-id",
      callback_capability_fingerprint: "callback-cap-fingerprint",
    },
    ...overrides,
  };
  const signedPayload = canonicalJson(payload);
  const signature = await sign(k12(new TextEncoder().encode(signedPayload), 32), seed);
  const envelope: GlyphSignedCallbackEnvelope = {
    version: GLYPH_CALLBACK_ENVELOPE_VERSION,
    result: signedResult,
    payload,
    proof: {
      algorithm: GLYPH_CALLBACK_SIGNATURE_ALGORITHM,
      identity: walletIdentity,
      public_key: bytesToBase64(publicKey),
      signature: bytesToBase64(signature),
      signed_payload: signedPayload,
    },
  };
  return { envelope, request, requestEnvelope, result: signedResult, payload };
}

function verificationFor(input: Awaited<ReturnType<typeof createSignedEnvelope>>) {
  return {
    requireSigned: true,
    expected: { nonce: input.request.nonce, type: input.request.type },
    expectedRequestHash: input.requestEnvelope.request_hash,
    expectedNetwork: input.requestEnvelope.network,
    expectedDappOrigin: input.request.dapp.origin,
    expectedExp: input.request.exp ?? null,
    expectedCallbackUrl: CALLBACK_URL,
    verifySignature: verifyWalletCallbackSignature,
  };
}

function assertMainnetV2Request(request: GlyphRequest) {
  const envelope = createMainnetGlyphEnvelope(request, CALLBACK_URL);
  const url = buildGlyphUrl(envelope);

  expect(envelope.protocol).toBe("glyph-connect-request/2");
  expect(envelope.network).toEqual({ id: "qubic:mainnet" });
  expect(envelope.network).toEqual(GLYPH_MAINNET_NETWORK);
  // Relay verification canonicalizes this expected value, so requests must retain the raw capability.
  expect(envelope.callback).toBe(CALLBACK_URL);
  expect(envelope.request_hash).toMatch(/^sha256:[A-Za-z0-9_-]{43}$/);
  expect(envelope.request_hash).toBe(computeRequestHash(envelope));
  expect(url).toStartWith("glyph://v2/request?d=");
}

describe("Glyph Connect v4 request initiation", () => {
  test("creates v2 mainnet envelopes with deterministic request hashes for every request builder", () => {
    assertMainnetV2Request(createConnectRequest({
      type: "connect",
      dapp: { name: "Glyph Qubic Starter", origin: DAPP_ORIGIN },
      permissions: ["transfer", "sc_call", "sign_message"],
    }, { nonce: "connect-nonce-1234", exp: FUTURE_EXP }));
    assertMainnetV2Request(createTransferRequest({
      type: "transfer",
      dapp: { name: "Glyph Qubic Starter", origin: DAPP_ORIGIN },
      to: IDENTITY,
      amount: "1",
      from: IDENTITY,
    }, { nonce: "transfer-nonce-1234", exp: FUTURE_EXP }));
    assertMainnetV2Request(createScCallRequest({
      type: "sc_call",
      dapp: { name: "Glyph Qubic Starter", origin: DAPP_ORIGIN },
      contract_index: 0,
      input_type: 0,
      amount: "0",
    }, { nonce: "sc-call-nonce-1234", exp: FUTURE_EXP }));
    assertMainnetV2Request(createSignMessageRequest({
      type: "sign_message",
      dapp: { name: "Glyph Qubic Starter", origin: DAPP_ORIGIN },
      message: "Glyph Connect v4",
      from: IDENTITY,
    }, { nonce: "sign-nonce-123456", exp: FUTURE_EXP }));
    assertMainnetV2Request(createVerifyMessageRequest({
      type: "verify_message",
      dapp: { name: "Glyph Qubic Starter", origin: DAPP_ORIGIN },
      message: "Glyph Connect v4",
      signature: "AA==",
      public_key: "AA==",
    }, { nonce: "verify-nonce-1234", exp: FUTURE_EXP }));
  });
});

describe("Glyph Connect v4 signed callback verification", () => {
  test("accepts Wallet's sanitized official Relay v2 binding against the raw prepared callback URL", async () => {
    const signed = await createSignedEnvelope();

    // verificationFor deliberately supplies CALLBACK_URL, the raw prepared capability.
    await expect(verifyCallbackEnvelope(signed.envelope, verificationFor(signed))).resolves.toEqual(signed.result);
  });

  test("rejects Wallet-shaped Relay callbacks for a different callback capability or session", async () => {
    const wrongCapability = await createSignedEnvelope(defaultResult(), {
      relay: {
        callback_url: walletSanitizedRelayCallbackUrl(
          "https://relay.glyphq.org/v2/callback/session-id-123456789012/c_9876543210987654321098",
        ),
        official_relay: true,
        route: "v2_session_callback",
        v1_nonce: null,
        session_id: "session-id",
        callback_capability_fingerprint: "wrong-callback-capability",
      },
    });
    const wrongSession = await createSignedEnvelope(defaultResult(), {
      relay: {
        callback_url: walletSanitizedRelayCallbackUrl(
          "https://relay.glyphq.org/v2/callback/other-session-123456789012/c_1234567890123456789012",
        ),
        official_relay: true,
        route: "v2_session_callback",
        v1_nonce: null,
        session_id: "other-session",
        callback_capability_fingerprint: "callback-cap-fingerprint",
      },
    });

    const expectedError = "relay callback_url does not match expected callback URL";
    await expect(verifyCallbackEnvelope(wrongCapability.envelope, verificationFor(wrongCapability))).rejects.toThrow(
      expectedError,
    );
    await expect(verifyCallbackEnvelope(wrongSession.envelope, verificationFor(wrongSession))).rejects.toThrow(
      expectedError,
    );
  });

  test("accepts a signed user rejection that is bound to the prepared request", async () => {
    const signed = await createSignedEnvelope({
      status: "rejected",
      type: "connect",
      nonce: "nonce-test-123456",
      reason: "user_rejected",
    });

    await expect(verifyCallbackEnvelope(signed.envelope, verificationFor(signed))).resolves.toEqual(signed.result);
  });

  test("accepts a signed sign-message callback bound to the sign request", async () => {
    const signed = await createSignedEnvelope({
      status: "signed",
      type: "sign_message",
      nonce: "sign-nonce-123456",
      identity: IDENTITY,
      signature: "AQID",
      public_key: "BAUG",
    });

    await expect(verifyCallbackEnvelope(signed.envelope, verificationFor(signed))).resolves.toEqual(signed.result);
  });

  test("rejects signed callbacks with a mismatched request hash or network", async () => {
    const signed = await createSignedEnvelope();

    await expect(verifyCallbackEnvelope(signed.envelope, {
      ...verificationFor(signed),
      expectedRequestHash: "sha256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    })).rejects.toThrow("request_hash does not match expected request");
    await expect(verifyCallbackEnvelope(signed.envelope, {
      ...verificationFor(signed),
      expectedNetwork: { id: "qubic:testnet" },
    })).rejects.toThrow("network does not match expected network");
  });

  test("rejects tampered signed payloads and unsigned callbacks", async () => {
    const signed = await createSignedEnvelope();
    const tampered = {
      ...signed.envelope,
      payload: { ...signed.envelope.payload, dapp_origin: "https://evil.example" },
    };

    await expect(verifyCallbackEnvelope(tampered, verificationFor(signed))).rejects.toThrow();
    await expect(verifyCallbackEnvelope(signed.result, verificationFor(signed))).rejects.toThrow(
      "signed Glyph callback envelope",
    );
  });

  test("rejects a signed callback whose proof key is not bound to its identity", async () => {
    const signed = await createSignedEnvelope();
    const tamperedProof = {
      ...signed.envelope,
      proof: { ...signed.envelope.proof, identity: "A".repeat(60) },
    };

    await expect(verifyCallbackEnvelope(tamperedProof, verificationFor(signed))).rejects.toThrow(
      "Callback envelope signature is invalid",
    );
  });

  test("drops capability-shaped support IDs from copied diagnostics", () => {
    const diagnostic = buildGlyphSafeDiagnostic({
      requestId: "local-7",
      requestType: "connect",
      state: "failed",
      failureCode: "verification_failed",
      supportId: "c_very-secret-callback-capability",
    });

    expect(JSON.parse(diagnostic).support_id).toBeNull();
    expect(diagnostic).not.toContain("very-secret-callback-capability");
  });
});

describe("Glyph request lifecycle diagnostics", () => {
  test("keeps correlation local and emits only an allow-listed redacted diagnostic", () => {
    const feedback = {
      requestId: "local-42",
      requestType: "transfer" as const,
      state: "interrupted" as const,
      failureCode: "relay_timeout" as const,
    };
    const diagnostic = buildGlyphSafeDiagnostic(feedback);

    expect(isGlyphRequestRetryable(feedback.state)).toBe(true);
    expect(diagnostic).toContain('"schema": "glyph-starter-diagnostic/v1"');
    expect(diagnostic).toContain('"request_type": "transfer"');
    expect(diagnostic).toContain('"failure_code": "relay_timeout"');
    expect(diagnostic).not.toContain(feedback.requestId);
    for (const forbidden of [
      "callback",
      "https://",
      "signed_payload",
      "signature",
      "public_key",
      "identity",
      "origin",
      "message",
      "amount",
      "raw error",
    ]) {
      expect(diagnostic.toLowerCase()).not.toContain(forbidden);
    }
  });

  test("does not offer retry for an accepted request", () => {
    expect(isGlyphRequestRetryable("completed")).toBe(false);
  });
});
