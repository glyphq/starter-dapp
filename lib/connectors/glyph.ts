import { identityToPublicKey, k12 } from "@qubic.org/crypto";
import {
  createConnectRequest,
  createSignMessageRequest,
  createTransferRequest,
  createVerifyMessageRequest,
  createEnvelope,
  createNonce,
  launchGlyphRequest,
  subscribeViaRelay,
  relayCallbackUrl,
  type GlyphPermission,
  type GlyphRequest,
  type GlyphCallbackResponse,
  type GlyphRequestStatus,
} from "@glyph-oss/connect";
import type {
  SignMessageResult,
  WalletAccount,
  WalletConnector,
  WalletConnectorEvent,
} from "@qubic.org/react";
import type { Identity } from "@qubic.org/types";

const STORAGE_KEY = "glyph-starter-account";
export const GLYPH_REQUEST_STATUS_EVENT = "glyph:request-status";

export type GlyphRequestFeedback =
  | { state: "opening" }
  | { state: "waiting" }
  | { state: "completed" }
  | { state: "failed" };
const permissions: GlyphPermission[] = ["transfer", "sign_message"];
const listeners = new Map<WalletConnectorEvent, Set<(...args: unknown[]) => void>>();

function appOrigin() {
  return process.env.NEXT_PUBLIC_APP_ORIGIN ?? "https://starter.glyphq.org";
}

function dapp() {
  return { name: "Glyph Qubic Starter", origin: appOrigin() };
}

function emit(event: WalletConnectorEvent, ...args: unknown[]) {
  listeners.get(event)?.forEach((listener) => listener(...args));
}

function emitRequestFeedback(detail: GlyphRequestFeedback) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<GlyphRequestFeedback>(GLYPH_REQUEST_STATUS_EVENT, { detail }));
}

function glyphRelayUrl() {
  return process.env.NEXT_PUBLIC_GLYPH_RELAY_URL ?? "https://relay.glyphq.org";
}

function mapRelayStatus(status: GlyphRequestStatus): GlyphRequestFeedback {
  switch (status.state) {
    case "opening_wallet": return { state: "opening" };
    case "awaiting_approval": return { state: "waiting" };
    case "completed": return { state: "completed" };
    case "failed": return { state: "failed" };
  }
}

async function requestFromGlyph(request: GlyphRequest): Promise<GlyphCallbackResponse> {
  const nonce = createNonce();
  const relayUrl = glyphRelayUrl();
  const envelope = createEnvelope(request, {
    callback: relayCallbackUrl(nonce, relayUrl),
  });

  const resultPromise = subscribeViaRelay(nonce, {
    relayUrl,
    onStatus(status) {
      emitRequestFeedback(mapRelayStatus(status));
    },
  });

  launchGlyphRequest(envelope);

  try {
    const result = await resultPromise;
    window.focus();
    return result;
  } catch (error) {
    throw error;
  }
}

function saveAccount(account: WalletAccount | null) {
  if (typeof window === "undefined") return;
  if (account) localStorage.setItem(STORAGE_KEY, JSON.stringify(account));
  else localStorage.removeItem(STORAGE_KEY);
}

function readAccount(): WalletAccount | null {
  if (typeof window === "undefined") return null;
  const value = localStorage.getItem(STORAGE_KEY);
  if (!value) return null;
  try {
    return JSON.parse(value) as WalletAccount;
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
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function requestGlyphTransfer(destination: string, amount: string) {
  const account = readAccount();
  if (!account) throw new Error("Connect Glyph Wallet before requesting a transfer.");
  const result = await requestFromGlyph(
    createTransferRequest({
      type: "transfer",
      dapp: dapp(),
      to: destination,
      amount,
      from: account.identity,
    }),
  );
  if (result.status === "rejected") throw new Error("Transfer request was rejected.");
  if (result.status !== "signed" || result.type !== "transfer") {
    throw new Error("Glyph Wallet returned an unexpected response.");
  }
  return { txId: result.tx_hash, targetTick: result.target_tick };
}

export async function requestGlyphVerification(message: string, signatureHex: string) {
  const account = readAccount();
  if (!account) throw new Error("Connect Glyph Wallet before verifying a signature.");
  const result = await requestFromGlyph(
    createVerifyMessageRequest({
      type: "verify_message",
      dapp: dapp(),
      message,
      signature: bytesToBase64(fromHex(signatureHex)),
      public_key: bytesToBase64(identityToPublicKey(account.identity)),
    }),
  );
  if (result.status === "rejected") throw new Error("Verification request was rejected.");
  if (result.status !== "verified") {
    throw new Error("Glyph Wallet returned an unexpected response.");
  }
  return result.valid;
}

export const glyphConnector: WalletConnector = {
  id: "glyph-wallet",
  isAvailable: () => typeof window !== "undefined",
  async connect() {
    const result = await requestFromGlyph(
      createConnectRequest({ type: "connect", dapp: dapp(), permissions }),
    );
    if (result.status === "rejected") throw new Error("Connection request was rejected.");
    if (result.status !== "connected") throw new Error("Glyph Wallet returned an unexpected response.");
    const account: WalletAccount = {
      identity: result.identity as Identity,
      name: "Glyph Wallet",
    };
    saveAccount(account);
    emit("accountChanged", account);
    return account;
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
  async signMessage(message: string): Promise<SignMessageResult> {
    const account = readAccount();
    if (!account) throw new Error("Connect Glyph Wallet before signing a message.");
    const result = await requestFromGlyph(
      createSignMessageRequest({
        type: "sign_message",
        dapp: dapp(),
        message,
        from: account.identity,
      }),
    );
    if (result.status === "rejected") throw new Error("Signature request was rejected.");
    if (result.status !== "signed" || result.type !== "sign_message") {
      throw new Error("Glyph Wallet returned an unexpected response.");
    }
    return {
      signatureHex: toHex(base64ToBytes(result.signature)),
      digestHex: toHex(k12(new TextEncoder().encode(message), 32)),
    };
  },
  on(event, callback) {
    const eventListeners = listeners.get(event) ?? new Set();
    eventListeners.add(callback);
    listeners.set(event, eventListeners);
    return () => eventListeners.delete(callback);
  },
};
