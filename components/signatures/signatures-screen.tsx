"use client";

import { useRef, useState, type FormEvent } from "react";
import { identityToPublicKey, k12, verify } from "@qubic.org/crypto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWalletSession } from "@/components/wallet/wallet-session-provider";
import { requestGlyphVerification } from "@/lib/connectors/glyph";
import { signatureBytes, validateSignatureInputs } from "@/lib/signatures";

export function SignaturesScreen() {
  const {
    wallet,
    pendingAction,
    runAction,
    ensureGlyphReady,
    openWalletDialog,
  } = useWalletSession();
  const [tab, setTab] = useState("sign");
  const [message, setMessage] = useState("");
  const [signatureInput, setSignatureInput] = useState("");
  const [resultAccount, setResultAccount] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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
  }

  function clearResults() {
    setSignature(null);
    setVerified(null);
    setError(null);
    setNotice(null);
  }

  async function submit(event: FormEvent, mode: "sign" | "verify") {
    event.preventDefault();
    if (busy || inFlight.current) return;
    clearResults();
    const validationError = validateSignatureInputs(
      message,
      mode === "verify" ? signatureInput : undefined,
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
    // Preparation never resumes this action. A fresh click keeps wallet launch user-initiated.
    if (isGlyph && !ensureGlyphReady()) {
      setNotice("Preparing Glyph. When ready, press the action button again.");
      return;
    }
    inFlight.current = true;
    setWorking(true);
    const failureMessage =
      mode === "sign"
        ? "The message could not be signed. Try again."
        : "The signature could not be verified. Check the inputs and try again.";
    try {
      // runAction invokes its operation synchronously, before any await here.
      if (mode === "sign") {
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

  return (
    <section
      className="flow-panel signatures-screen"
      aria-labelledby="signatures-heading"
      aria-busy={busy}
    >
      <header className="flow-heading">
        <h2 id="signatures-heading">Sign &amp; Verify</h2>
        <p>
          Sign a message or check a signature against your connected identity.
        </p>
      </header>
      <Tabs
        value={tab}
        onValueChange={(value) => {
          if (busy) return;
          setTab(String(value));
          clearResults();
        }}
      >
        <TabsList aria-label="Signature actions">
          <TabsTrigger value="sign" disabled={busy}>
            Sign message
          </TabsTrigger>
          <TabsTrigger value="verify" disabled={busy}>
            Verify signature
          </TabsTrigger>
        </TabsList>
        <div className="signature-message">
          <label htmlFor="signature-message">Message</label>
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
        </div>
        <TabsContent value="sign">
          <form
            className="task-form"
            onSubmit={(event) => void submit(event, "sign")}
          >
            <p className="notice">
              Signing can authorize actions in other apps. Read messages
              carefully; this request does not transfer funds.
            </p>
            <div className="form-actions">
              {connected ? (
                <Button type="submit" disabled={busy}>
                  {working ? "Signing…" : "Sign message"}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={openWalletDialog}
                  disabled={busy}
                >
                  Connect to sign
                </Button>
              )}
            </div>
          </form>
          {signature !== null && resultAccount === accountKey && (
            <div className="output-block" role="status">
              <p className="result-line">Message signed. Signature:</p>
              <code className="signature-output break-all">{signature}</code>
              <Button
                variant="outline"
                className="signature-next"
                disabled={busy}
                onClick={() => {
                  setSignatureInput(signature);
                  setTab("verify");
                  clearResults();
                }}
              >
                Verify this signature
              </Button>
            </div>
          )}
        </TabsContent>
        <TabsContent value="verify">
          <form
            className="task-form"
            onSubmit={(event) => void submit(event, "verify")}
          >
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
            <p className="notice">
              {isGlyph
                ? "Glyph Wallet checks the signature."
                : "Verification runs locally in your browser."}
            </p>
            <div className="form-actions">
              {connected ? (
                <Button type="submit" disabled={busy}>
                  {working ? "Verifying…" : "Verify signature"}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={openWalletDialog}
                  disabled={busy}
                >
                  Connect to verify
                </Button>
              )}
            </div>
          </form>
          {verified !== null && resultAccount === accountKey && (
            <p
              className={verified ? "result-line" : "error-line"}
              role="status"
            >
              {verified
                ? "Signature is valid for this message and connected identity."
                : "Signature is not valid for this message and connected identity."}
            </p>
          )}
        </TabsContent>
      </Tabs>
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
