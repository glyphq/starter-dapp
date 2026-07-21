"use client";

import { useWallet } from "@qubic.org/react";
import { identityToPublicKey, isValidIdentityChecksum, k12, verify } from "@qubic.org/crypto";
import {
  CheckCircle,
  CloseCircle,
  Code2,
  Copy,
  Key,
  Logout,
  Monitor,
  Pen,
  PlugCircle,
  SendSquare,
  ShieldCheck,
  Smartphone,
  Wallet,
} from "@solar-icons/react";
import { QRCodeSVG } from "qrcode.react";
import {
  useMemo,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type SVGProps,
} from "react";
import { hasWalletConnectProjectId } from "@/lib/connectors";
import {
  GLYPH_REQUEST_STATUS_EVENT,
  requestGlyphTransfer,
  requestGlyphVerification,
  type GlyphRequestFeedback,
} from "@/lib/connectors/glyph";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

type ConnectorDetail = {
  label: string;
  description: string;
  Icon: Icon;
  requirement?: string;
};

const connectorDetails: Record<string, ConnectorDetail> = {
  "glyph-wallet": {
    label: "Glyph Wallet",
    description: "Connect through the Glyph desktop application.",
    Icon: Wallet,
  },
  "qubic-extension": {
    label: "Qubic browser extension",
    description: "Use the Qubic provider installed in this browser.",
    Icon: Monitor,
    requirement: "Browser provider required",
  },
  walletconnect: {
    label: "WalletConnect",
    description: "Pair a compatible Qubic wallet with a QR code.",
    Icon: Smartphone,
    requirement: "Project ID required",
  },
};

function shortIdentity(identity: string) {
  return `${identity.slice(0, 12)}…${identity.slice(-12)}`;
}

function LoadingIcon() {
  return <span className="spinner" aria-hidden="true" />;
}

function hexToBytes(value: string) {
  const normalized = value.trim();
  if (!/^[0-9a-fA-F]+$/.test(normalized) || normalized.length % 2 !== 0) {
    throw new Error("Enter a complete hexadecimal signature.");
  }
  return Uint8Array.from(normalized.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16));
}

export function StarterApp() {
  const wallet = useWallet();
  const mounted = useSyncExternalStore(() => () => undefined, () => true, () => false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const connectButtonRef = useRef<HTMLButtonElement>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pairingUri, setPairingUri] = useState<string | null>(null);
  const [message, setMessage] = useState("Confirm access to Glyph Qubic Starter");
  const [signature, setSignature] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [activeAction, setActiveAction] = useState<"transfer" | "sign" | "verify">("transfer");
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("1");
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferResult, setTransferResult] = useState<string | null>(null);
  const [verifySignature, setVerifySignature] = useState("");
  const [verificationResult, setVerificationResult] = useState<boolean | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [glyphFeedback, setGlyphFeedback] = useState<GlyphRequestFeedback | null>(null);

  useEffect(() => {
    let clearTimer: number | undefined;
    const receiveFeedback = (event: Event) => {
      const feedback = (event as CustomEvent<GlyphRequestFeedback>).detail;
      setGlyphFeedback(feedback);
      if (feedback.state === "completed" || feedback.state === "failed") {
        window.clearTimeout(clearTimer);
        clearTimer = window.setTimeout(() => setGlyphFeedback(null), 1800);
      }
    };

    window.addEventListener(GLYPH_REQUEST_STATUS_EVENT, receiveFeedback);
    return () => {
      window.removeEventListener(GLYPH_REQUEST_STATUS_EVENT, receiveFeedback);
      window.clearTimeout(clearTimer);
    };
  }, []);

  const activeDetail = useMemo(
    () => (wallet.activeConnector ? connectorDetails[wallet.activeConnector.id] : null),
    [wallet.activeConnector],
  );

  function openConnectorModal() {
    setActionError(null);
    setPairingUri(null);
    dialogRef.current?.showModal();
  }

  function closeConnectorModal() {
    if (pendingId) return;
    dialogRef.current?.close();
    connectButtonRef.current?.focus();
  }

  async function connect(connectorId: string) {
    setPendingId(connectorId);
    setPairingUri(null);
    setActionError(null);
    try {
      await wallet.connect(connectorId, { onUri: setPairingUri });
      dialogRef.current?.close();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Connection failed.");
    } finally {
      setPendingId(null);
    }
  }

  async function disconnect() {
    setPendingId(wallet.activeConnector?.id ?? "disconnect");
    setActionError(null);
    try {
      await wallet.disconnect();
      setSignature(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not disconnect.");
    } finally {
      setPendingId(null);
    }
  }

  async function signMessage() {
    setIsSigning(true);
    setSignature(null);
    setActionError(null);
    try {
      const result = await wallet.signMessage(message);
      setSignature(result.signatureHex);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Message signing failed.");
    } finally {
      setIsSigning(false);
    }
  }

  async function sendTransfer() {
    if (!wallet.activeConnector) return;
    setIsTransferring(true);
    setTransferResult(null);
    setActionError(null);
    try {
      if (!isValidIdentityChecksum(destination.trim())) {
        throw new Error("Enter a valid Qubic destination identity.");
      }
      if (!/^\d+$/.test(amount.trim()) || BigInt(amount.trim()) <= BigInt(0)) {
        throw new Error("Enter a positive whole-number amount.");
      }
      const result = wallet.activeConnector.id === "glyph-wallet"
        ? await requestGlyphTransfer(destination.trim(), amount.trim())
        : await wallet.sendTransaction({ destination: destination.trim(), amount: amount.trim() });
      setTransferResult(result.txId);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Transfer request failed.");
    } finally {
      setIsTransferring(false);
    }
  }

  async function verifyMessageSignature() {
    if (!wallet.account || !wallet.activeConnector) return;
    setIsVerifying(true);
    setActionError(null);
    try {
      if (wallet.activeConnector.id === "glyph-wallet") {
        setVerificationResult(await requestGlyphVerification(message, verifySignature));
      } else {
        const digest = k12(new TextEncoder().encode(message), 32);
        const publicKey = identityToPublicKey(wallet.account.identity);
        setVerificationResult(verify(digest, hexToBytes(verifySignature), publicKey));
      }
    } catch (error) {
      setVerificationResult(null);
      setActionError(error instanceof Error ? error.message : "Signature verification failed.");
    } finally {
      setIsVerifying(false);
    }
  }

  async function copyIdentity() {
    if (!wallet.account) return;
    await navigator.clipboard.writeText(wallet.account.identity);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="https://glyphq.org" aria-label="Glyph home">
          glyph<span>.</span>
        </a>
        <span className="product-name">Qubic starter</span>
        <a className="header-link" href="https://docs.glyphq.org">
          <Code2 aria-hidden="true" />
          Docs
        </a>
      </header>

      <main className="wallet-stage">
        <section className="wallet-card" aria-labelledby="wallet-state-title">
          {wallet.account && activeDetail ? (
            <>
              <div className="wallet-mark connected"><activeDetail.Icon aria-hidden="true" /></div>
              <p className="state-label"><CheckCircle aria-hidden="true" /> Connected with {activeDetail.label}</p>
              <h1 id="wallet-state-title">Wallet connected</h1>
              {glyphFeedback && (
                <p className={`request-feedback request-feedback-${glyphFeedback.state}`} role="status">
                  {glyphFeedback.state === "opening" && "Opening Glyph Wallet"}
                  {glyphFeedback.state === "waiting" && "Continue in Glyph Wallet. This page will update after your response."}
                  {glyphFeedback.state === "completed" && "Wallet response received"}
                  {glyphFeedback.state === "failed" && "The wallet request did not complete"}
                </p>
              )}
              <button className="identity" onClick={copyIdentity} title={wallet.account.identity}>
                <Key aria-hidden="true" />
                <span>{shortIdentity(wallet.account.identity)}</span>
                {copied ? <CheckCircle aria-label="Copied" /> : <Copy aria-label="Copy identity" />}
              </button>

              <div className="wallet-actions" aria-label="Wallet actions">
                <button className={activeAction === "transfer" ? "active" : ""} onClick={() => setActiveAction("transfer")}><SendSquare aria-hidden="true" />Transfer</button>
                <button className={activeAction === "sign" ? "active" : ""} onClick={() => setActiveAction("sign")}><Pen aria-hidden="true" />Sign</button>
                <button className={activeAction === "verify" ? "active" : ""} onClick={() => setActiveAction("verify")}><ShieldCheck aria-hidden="true" />Verify</button>
              </div>

              <div className="action-area">
                {activeAction === "transfer" && (
                  <>
                    <p className="action-note">This requests a real wallet-approved transfer on Qubic mainnet.</p>
                    <label htmlFor="destination">Destination identity</label>
                    <input id="destination" value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="60-character Qubic identity" />
                    <label htmlFor="amount">Amount</label>
                    <input id="amount" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} />
                    <button className="button" onClick={sendTransfer} disabled={isTransferring || !destination.trim() || !amount.trim()}>
                      {isTransferring ? <LoadingIcon /> : <SendSquare aria-hidden="true" />}
                      {isTransferring ? "Waiting for approval" : "Test transfer"}
                    </button>
                    {transferResult && <p className="compact-result" role="status"><CheckCircle aria-hidden="true" />Transfer submitted: <code>{transferResult}</code></p>}
                  </>
                )}

                {activeAction === "sign" && (
                  <>
                    <label htmlFor="message">Message</label>
                    <textarea id="message" value={message} onChange={(event) => setMessage(event.target.value)} rows={2} />
                    <button className="button" onClick={signMessage} disabled={isSigning || !message.trim()}>
                      {isSigning ? <LoadingIcon /> : <Pen aria-hidden="true" />}
                      {isSigning ? "Waiting for approval" : "Sign message"}
                    </button>
                    {signature && <p className="compact-result" role="status"><CheckCircle aria-hidden="true" />Signature: <code>{signature}</code></p>}
                  </>
                )}

                {activeAction === "verify" && (
                  <>
                    <p className="action-note">{wallet.activeConnector?.id === "glyph-wallet" ? "Glyph Wallet will display and verify this signature." : "This signature is verified locally against the connected identity."}</p>
                    <label htmlFor="verify-message">Message</label>
                    <textarea id="verify-message" value={message} onChange={(event) => setMessage(event.target.value)} rows={2} />
                    <label htmlFor="signature">Signature</label>
                    <textarea id="signature" value={verifySignature} onChange={(event) => setVerifySignature(event.target.value)} rows={2} placeholder="Hexadecimal signature" />
                    <button className="button" onClick={verifyMessageSignature} disabled={isVerifying || !message.trim() || !verifySignature.trim()}>{isVerifying ? <LoadingIcon /> : <ShieldCheck aria-hidden="true" />}{isVerifying ? "Waiting for verification" : "Verify signature"}</button>
                    {verificationResult !== null && <p className={`compact-result ${verificationResult ? "valid" : "invalid"}`} role="status"><ShieldCheck aria-hidden="true" />{verificationResult ? "Signature is valid" : "Signature is not valid"}</p>}
                  </>
                )}
              </div>

              <button className="quiet-button" onClick={disconnect} disabled={Boolean(pendingId)}>
                {pendingId ? <LoadingIcon /> : <Logout aria-hidden="true" />}
                Disconnect wallet
              </button>
            </>
          ) : (
            <>
              <div className="wallet-mark"><Wallet aria-hidden="true" /></div>
              <p className="state-label">Qubic wallet connection</p>
              <h1 id="wallet-state-title">No wallet connected</h1>
              <p className="state-copy">Choose a connector to continue with this application.</p>
              <button ref={connectButtonRef} className="button connect-button" onClick={openConnectorModal}>
                <PlugCircle aria-hidden="true" />
                Connect wallet
              </button>
            </>
          )}

          {(actionError || wallet.error) && (
            <div className="error-message" role="alert">
              <ShieldCheck aria-hidden="true" />
              <p>{actionError ?? wallet.error?.message}</p>
            </div>
          )}
        </section>
      </main>

      <p className="disclosure">Independent software built for Qubic.</p>

      <dialog
        ref={dialogRef}
        className="connector-dialog"
        aria-labelledby="connector-dialog-title"
        onCancel={(event) => {
          if (pendingId) event.preventDefault();
        }}
        onClose={() => connectButtonRef.current?.focus()}
        onClick={(event) => {
          if (event.target === dialogRef.current) closeConnectorModal();
        }}
      >
        <div className="dialog-surface">
          <div className="dialog-heading">
            <div>
              <p className="dialog-eyebrow">Connect wallet</p>
              <h2 id="connector-dialog-title">Choose a connector</h2>
            </div>
            <button className="icon-button" onClick={closeConnectorModal} disabled={Boolean(pendingId)} aria-label="Close connector selection">
              <CloseCircle aria-hidden="true" />
            </button>
          </div>

          <div className="connector-list">
            {wallet.connectors.map((connector) => {
              const detail = connectorDetails[connector.id];
              const available = mounted && connector.isAvailable();
              const needsProjectId = connector.id === "walletconnect" && !hasWalletConnectProjectId;
              const disabled = Boolean(pendingId) || !available || needsProjectId;
              const Icon = detail.Icon;
              return (
                <button
                  className="connector-option"
                  disabled={disabled}
                  key={connector.id}
                  onClick={() => connect(connector.id)}
                >
                  <span className="connector-icon"><Icon aria-hidden="true" /></span>
                  <span className="connector-copy">
                    <strong>{detail.label}</strong>
                    <span>{detail.description}</span>
                    <small className={available && !needsProjectId ? "ready" : ""}>
                      {needsProjectId ? "Configuration required" : available ? "Ready" : detail.requirement ?? "Unavailable"}
                    </small>
                  </span>
                  <span className="option-state">
                    {pendingId === connector.id ? <LoadingIcon /> : <PlugCircle aria-hidden="true" />}
                  </span>
                </button>
              );
            })}
          </div>

          {pairingUri && (
            <div className="pairing" role="status">
              <div className="qr-frame"><QRCodeSVG value={pairingUri} size={164} /></div>
              <div><strong>Scan with your wallet</strong><p>Keep this window open while the session is approved.</p></div>
            </div>
          )}

          {pendingId === "glyph-wallet" && glyphFeedback && (
            <p className={`dialog-progress request-feedback-${glyphFeedback.state}`} role="status">
              {glyphFeedback.state === "opening" && "Opening Glyph Wallet"}
              {glyphFeedback.state === "waiting" && "Approve or reject the connection in Glyph Wallet."}
              {glyphFeedback.state === "completed" && "Wallet response received"}
              {glyphFeedback.state === "failed" && "The wallet request did not complete"}
            </p>
          )}

          {actionError && <p className="dialog-error" role="alert">{actionError}</p>}
        </div>
      </dialog>
    </div>
  );
}
