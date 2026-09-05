"use client";

import { useRef, useState, type FormEvent } from "react";
import { identityToPublicKey, k12, verify } from "@qubic.org/crypto";
import {
  BadgeCheckIcon,
  CopyIcon,
  PenLineIcon,
  WalletIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWalletSession } from "@/components/wallet/wallet-session-provider";
import { requestGlyphVerification } from "@/lib/connectors/glyph";
import { signatureBytes, validateSignatureInputs } from "@/lib/signatures";

type SignatureMode = "sign" | "verify";

export function SignaturesScreen() {
  const {
    wallet,
    pendingAction,
    runAction,
    ensureGlyphReady,
    openWalletDialog,
  } = useWalletSession();
  const [mode, setMode] = useState<SignatureMode>("sign");
  const [message, setMessage] = useState("");
  const [signatureInput, setSignatureInput] = useState("");
  const [resultAccount, setResultAccount] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const inFlight = useRef(false);
  const busy = working || pendingAction !== null;
  const connected = Boolean(wallet.account && wallet.activeConnector);
  const isGlyph = wallet.activeConnector?.id === "glyph-wallet";

  const accountKey = `${wallet.activeConnector?.id ?? "none"}:${wallet.account?.identity ?? "none"}`;
  const [previousAccountKey, setPreviousAccountKey] = useState(accountKey);
  if (accountKey !== previousAccountKey) {
    setPreviousAccountKey(accountKey);
    setSignature(null);
    setVerified(null);
    setError(null);
    setNotice(null);
    setCopyStatus(null);
  }

  function clearResults() {
    setSignature(null);
    setVerified(null);
    setError(null);
    setNotice(null);
    setCopyStatus(null);
  }

  function switchMode(nextMode: SignatureMode) {
    if (busy) return;
    setMode(nextMode);
    clearResults();
  }

  async function submit(event: FormEvent, nextMode: SignatureMode) {
    event.preventDefault();
    if (busy || inFlight.current) return;
    clearResults();
    const validationError = validateSignatureInputs(
      message,
      nextMode === "verify" ? signatureInput : undefined,
    );
    if (validationError) {
      setError(validationError);
      return;
    }
    const account = wallet.account;
    if (!account || !wallet.activeConnector) {
      openWalletDialog();
      return;
    }
    if (isGlyph && !ensureGlyphReady()) {
      setNotice("Preparing Glyph. When ready, press the action button again.");
      return;
    }
    inFlight.current = true;
    setWorking(true);
    const failureMessage =
      nextMode === "sign"
        ? "The message could not be signed. Try again."
        : "The signature could not be verified. Check the inputs and try again.";
    try {
      if (nextMode === "sign") {
        const result = await runAction(
          "Signing message",
          () => wallet.signMessage(message),
          failureMessage,
        );
        if (result !== undefined) {
          setResultAccount(accountKey);
          setSignature(result.signatureHex);
        }
      } else {
        const result = await runAction(
          "Verifying signature",
          () => {
            if (isGlyph)
              return requestGlyphVerification(message, signatureInput);
            return Promise.resolve(
              verify(
                k12(new TextEncoder().encode(message), 32),
                signatureBytes(signatureInput),
                identityToPublicKey(account.identity),
              ),
            );
          },
          failureMessage,
        );
        if (result !== undefined) {
          setResultAccount(accountKey);
          setVerified(result);
        }
      }
    } finally {
      inFlight.current = false;
      setWorking(false);
    }
  }

  async function copySignature() {
    if (!signature) return;
    try {
      await navigator.clipboard.writeText(signature);
      setCopyStatus("Signature copied.");
    } catch {
      setCopyStatus("Select the signature to copy it.");
    }
  }

  const title = mode === "sign" ? "Sign a message" : "Verify a signature";
  const description =
    mode === "sign"
      ? "Write a message, then approve it in your wallet."
      : "Check a signature against your connected identity.";

  return (
    <section
      className="flow-panel signatures-screen"
      aria-labelledby="signatures-heading"
      aria-busy={busy}
    >
      <header className="flow-heading">
        <h2 id="signatures-heading">{title}</h2>
        <p>{description}</p>
      </header>

      <form
        className="task-form signature-form"
        onSubmit={(event) => void submit(event, mode)}
      >
        <label htmlFor="signature-message">
          Message
          <textarea
            id="signature-message"
            className="message-textarea"
            rows={4}
            value={message}
            disabled={busy}
            autoComplete="off"
            placeholder="Enter the exact message"
            onChange={(event) => {
              setMessage(event.target.value);
              clearResults();
            }}
          />
        </label>

        {mode === "verify" && (
          <label htmlFor="signature-hex">
            Signature
            <Input
              id="signature-hex"
              value={signatureInput}
              disabled={busy}
              placeholder="128 hexadecimal characters"
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => {
                setSignatureInput(event.target.value);
                clearResults();
              }}
            />
          </label>
        )}

        <p className="notice">
          {mode === "sign"
            ? "Read messages carefully. Signing does not transfer funds."
            : isGlyph
              ? "Glyph Wallet checks the signature."
              : "Verification runs locally in your browser."}
        </p>
        <div className="form-actions task-action-stack">
          {connected ? (
            <Button type="submit" disabled={busy}>
              {mode === "sign" ? (
                <PenLineIcon aria-hidden="true" />
              ) : (
                <BadgeCheckIcon aria-hidden="true" />
              )}
              {working
                ? mode === "sign"
                  ? "Signing…"
                  : "Verifying…"
                : mode === "sign"
                  ? "Sign message"
                  : "Verify signature"}
            </Button>
          ) : (
            <Button type="button" onClick={openWalletDialog} disabled={busy}>
              <WalletIcon aria-hidden="true" />
              Connect wallet
            </Button>
          )}
          {connected &&
            (mode === "sign" ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => switchMode("verify")}
                disabled={busy}
              >
                <BadgeCheckIcon aria-hidden="true" />
                Verify an existing signature
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                onClick={() => switchMode("sign")}
                disabled={busy}
              >
                <PenLineIcon aria-hidden="true" />
                Sign a message
              </Button>
            ))}
        </div>
      </form>

      {mode === "sign" &&
        signature !== null &&
        resultAccount === accountKey && (
          <div className="signature-result" role="status" aria-live="polite">
            <span className="data-label">Signature ready</span>
            <code className="signature-output">{signature}</code>
            <div className="form-actions task-action-stack">
              <Button
                variant="outline"
                onClick={() => void copySignature()}
                disabled={busy}
              >
                <CopyIcon aria-hidden="true" />
                Copy signature
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setSignatureInput(signature);
                  setMode("verify");
                  clearResults();
                }}
              >
                <BadgeCheckIcon aria-hidden="true" />
                Verify this signature
              </Button>
            </div>
          </div>
        )}

      {mode === "verify" &&
        verified !== null &&
        resultAccount === accountKey && (
          <p className={verified ? "result-line" : "error-line"} role="status">
            {verified
              ? "Signature is valid for this message and connected identity."
              : "Signature is not valid for this message and connected identity."}
          </p>
        )}
      {copyStatus && (
        <p className="help-text" role="status">
          {copyStatus}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="error-line" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
