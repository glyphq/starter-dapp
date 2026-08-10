import { describe, expect, test } from "bun:test";
import {
  GLYPH_CALLBACK_ENVELOPE_VERSION,
  GLYPH_CALLBACK_SIGNATURE_ALGORITHM,
  canonicalDappOrigin,
  verifyCallbackEnvelope,
  type GlyphCallbackResponse,
  type GlyphCallbackSignaturePayload,
  type GlyphSignedCallbackEnvelope,
} from "@glyph-oss/connect";
import { generateRandomSeed, k12, publicKeyFromSeed, sign } from "@qubic.org/crypto";
import { verifyWalletCallbackSignature } from "./glyph";

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(",")}}`;
}

function bytesToBase64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64");
}

function bytesToBase64Url(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64url");
}

async function sha256Base64Url(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

async function createSignedEnvelope(overrides: Partial<GlyphCallbackSignaturePayload> = {}) {
  const seed = generateRandomSeed();
  const publicKey = publicKeyFromSeed(seed);
  const result: GlyphCallbackResponse = {
    status: "connected",
    type: "connect",
    nonce: "nonce-test-123",
    identity: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    permissions: ["transfer", "sign_message"],
  };
  const payload: GlyphCallbackSignaturePayload = {
    version: GLYPH_CALLBACK_ENVELOPE_VERSION,
    nonce: result.nonce,
    dapp_origin: canonicalDappOrigin("https://starter.glyphq.org"),
    request_type: result.type,
    exp: 1234567890,
    result_hash: await sha256Base64Url(canonicalize(result)),
    relay: {
      callback_url: "https://relay.glyphq.org/v2/session/session-id/callback/callback-cap",
      official_relay: true,
      route: "v2_session_callback",
      v1_nonce: null,
      session_id: "session-id",
      callback_capability_fingerprint: "callback-cap-fingerprint",
    },
    ...overrides,
  };
  const signedPayload = canonicalize(payload);
  const signature = await sign(k12(new TextEncoder().encode(signedPayload), 32), seed);
  const envelope: GlyphSignedCallbackEnvelope = {
    version: GLYPH_CALLBACK_ENVELOPE_VERSION,
    result,
    payload,
    proof: {
      algorithm: GLYPH_CALLBACK_SIGNATURE_ALGORITHM,
      identity: result.identity,
      public_key: bytesToBase64(publicKey),
      signature: bytesToBase64(signature),
      signed_payload: signedPayload,
    },
  };
  return { envelope, result, payload };
}

describe("Glyph signed callback verification", () => {
  test("accepts actual SchnorrQ signed relay v2 callback envelopes", async () => {
    const { envelope, result, payload } = await createSignedEnvelope();

    await expect(verifyCallbackEnvelope(envelope, {
      requireSigned: true,
      expected: { nonce: result.nonce, type: result.type },
      expectedDappOrigin: "https://starter.glyphq.org",
      expectedExp: payload.exp,
      expectedCallbackUrl: payload.relay.callback_url,
      verifySignature: verifyWalletCallbackSignature,
    })).resolves.toEqual(result);
  });

  test("rejects tampered signed payloads", async () => {
    const { envelope, result, payload } = await createSignedEnvelope();
    const tampered = {
      ...envelope,
      payload: { ...envelope.payload, dapp_origin: "https://evil.example" },
    };

    await expect(verifyCallbackEnvelope(tampered, {
      requireSigned: true,
      expected: { nonce: result.nonce, type: result.type },
      expectedDappOrigin: "https://starter.glyphq.org",
      expectedExp: payload.exp,
      expectedCallbackUrl: payload.relay.callback_url,
      verifySignature: verifyWalletCallbackSignature,
    })).rejects.toThrow();
  });

  test("rejects unsigned callbacks when strict relay verification is required", async () => {
    const { result } = await createSignedEnvelope();

    await expect(verifyCallbackEnvelope(result, {
      requireSigned: true,
      expected: { nonce: result.nonce, type: result.type },
      verifySignature: verifyWalletCallbackSignature,
    })).rejects.toThrow("signed Glyph callback envelope");
  });
});
