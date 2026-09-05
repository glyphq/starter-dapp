"use client";

import { useRef, useState, type FormEvent } from "react";
import { identityToPublicKey, k12, verify } from "@qubic.org/crypto";
import {
  BadgeCheckIcon,
  CopyIcon,
  PenLineIcon,
  WalletIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Identicon } from "@/components/wallet/identicon";
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
  const [messageInvalid, setMessageInvalid] = useState(false);
  const [signatureInvalid, setSignatureInvalid] = useState(false);
  const [working, setWorking] = useState(false);
  const inFlight = useRef(false);
  const busy = working || pendingAction !== null;
  const connected = Boolean(wallet.account && wallet.activeConnector);
  const isGlyph = wallet.activeConnector?.id === "glyph-wallet";

  const accountKey = `${wallet.activeConnector?.id ?? "none"}:${wallet.account?.identity ?? "none"}`;

  function clearResults() {
    setSignature(null);
  }

  function switchMode(nextMode: SignatureMode) {
    if (busy) return;
    setMode(nextMode);
    setMessageInvalid(false);
    setSignatureInvalid(false);
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
      setMessageInvalid(validationError === "Enter a message.");
      setSignatureInvalid(validationError !== "Enter a message.");
      toast.error(validationError);
      return;
    }
    setMessageInvalid(false);
    setSignatureInvalid(false);
    const account = wallet.account;
    if (!account || !wallet.activeConnector) {
      openWalletDialog();
      return;
    }
    if (isGlyph && !ensureGlyphReady()) {
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
          toast.success("Signature ready.", {
            icon: <Identicon identity={account.identity} size={20} />,
          });
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
          if (result) {
            toast.success("Signature verified.", {
              description: "It matches this message and connected identity.",
              icon: <Identicon identity={account.identity} size={20} />,
            });
          } else {
            toast.error("Signature did not verify.", {
              description:
                "Check the message, signature, and connected identity.",
              icon: <Identicon identity={account.identity} size={20} />,
            });
          }
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
      toast.success("Signature copied.", {
        icon: wallet.account ? (
          <Identicon identity={wallet.account.identity} size={20} />
        ) : undefined,
      });
    } catch {
      toast.message("Select the signature to copy it.");
    }
  }

  const title = mode === "sign" ? "Sign a message" : "Verify a signature";
  const description =
    mode === "sign"
      ? "Write a message, then approve it in your wallet."
      : "Check a signature against your connected identity.";

  if (!connected) {
    return (
      <section
        className="flow-panel signatures-screen"
        aria-labelledby="signatures-heading"
      >
        <header className="flow-heading">
          <h2 id="signatures-heading">Sign &amp; Verify</h2>
          <p>Connect a wallet to sign messages or verify a signature.</p>
        </header>
        <div className="form-actions task-action-stack">
          <Button type="button" onClick={openWalletDialog} disabled={busy}>
            <WalletIcon aria-hidden="true" />
            Connect wallet
          </Button>
        </div>
      </section>
    );
  }

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
            aria-invalid={messageInvalid || undefined}
            autoComplete="off"
            placeholder="Enter the exact message"
            onChange={(event) => {
              setMessage(event.target.value);
              setMessageInvalid(false);
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
              aria-invalid={signatureInvalid || undefined}
              placeholder="128 hexadecimal characters"
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => {
                setSignatureInput(event.target.value);
                setSignatureInvalid(false);
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
          {mode === "sign" ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => switchMode("verify")}
              disabled={busy}
            >
              <BadgeCheckIcon aria-hidden="true" />
              Verify an existing signature
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => switchMode("sign")}
              disabled={busy}
            >
              <PenLineIcon aria-hidden="true" />
              Sign a message
            </Button>
          )}
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
    </section>
  );
}
