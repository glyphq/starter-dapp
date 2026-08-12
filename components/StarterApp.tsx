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
  useCallback,
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
  buildGlyphSafeDiagnostic,
  createGlyphRequestIntentHandlers,
  glyphFailureMessage,
  glyphRequestMilestoneLabel,
  isGlyphRequestRetryable,
  isGlyphRelaySessionReady,
  prewarmGlyphRelaySession,
  prepareFreshGlyphRelaySession,
  requestGlyphTransfer,
  requestGlyphVerification,
  type GlyphRequestFeedback,
  type GlyphRequestMilestone,
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
    description: "Desktop approval through Glyph.",
    Icon: Wallet,
  },
  "qubic-extension": {
    label: "Qubic browser extension",
    description: "Use the browser provider.",
    Icon: Monitor,
    requirement: "Browser provider required",
  },
  walletconnect: {
    label: "WalletConnect",
    description: "Pair by QR code.",
    Icon: Smartphone,
    requirement: "Project ID required",
  },
};

const fallbackConnectorDetail: ConnectorDetail = {
  label: "Wallet connector",
  description: "Use this wallet provider.",
  Icon: Wallet,
};

function connectorDetail(id: string): ConnectorDetail {
  return connectorDetails[id] ?? fallbackConnectorDetail;
}

function connectorAvailable(connector: { isAvailable: () => boolean }) {
  try {
    return connector.isAvailable();
  } catch {
    return false;
  }
}

function shortIdentity(identity: string) {
  return `${identity.slice(0, 12)}…${identity.slice(-12)}`;
}

function LoadingIcon() {
  return <span className="spinner" aria-hidden="true" />;
}

function glyphMilestoneDescription(feedback: GlyphRequestFeedback) {
  switch (feedback.state) {
    case "opening": return "Opening Glyph Wallet.";
    case "awaiting_approval": return "Approve or reject this request in Glyph Wallet.";
    case "verifying": return "Checking the verified callback against this request.";
    case "completed": return "The wallet response was verified and accepted.";
    case "interrupted":
      return feedback.failureCode ? glyphFailureMessage(feedback.failureCode) : "The approval flow ended before a response arrived.";
    case "failed":
      return feedback.failureCode ? glyphFailureMessage(feedback.failureCode) : "The request was not accepted.";
    case "preparing": return "Preparing a secure Relay v2 session.";
  }
}

function GlyphRequestLifecycle({
  feedback,
  preparing,
  onRetry,
  onCopyDiagnostic,
  diagnosticCopied,
}: {
  feedback: GlyphRequestFeedback | null;
  preparing: boolean;
  onRetry: () => void;
  onCopyDiagnostic: () => void;
  diagnosticCopied: boolean;
}) {
  const state: GlyphRequestMilestone = preparing ? "preparing" : feedback?.state ?? "preparing";
  const retryable = feedback ? isGlyphRequestRetryable(feedback.state) : false;
  return (
    <div className="request-lifecycle-slot">
      {(feedback || preparing) && (
        <div className={`request-lifecycle request-lifecycle-${state}`} role="status" aria-live="polite">
          <div className="request-lifecycle-heading">
            <span className="request-lifecycle-marker" aria-hidden="true">
              {state === "completed" ? <CheckCircle /> : state === "failed" || state === "interrupted" ? <CloseCircle /> : <LoadingIcon />}
            </span>
            <div>
              <strong>{glyphRequestMilestoneLabel(state)}</strong>
              <p>{preparing ? "Preparing a secure Relay v2 session." : feedback ? glyphMilestoneDescription(feedback) : ""}</p>
            </div>
          </div>
          {retryable && feedback && (
            <div className="request-lifecycle-actions">
              <button className="button lifecycle-retry" type="button" onClick={onRetry} disabled={preparing}>
                <PlugCircle aria-hidden="true" />
                {preparing ? "Preparing retry" : "Retry with a new request"}
              </button>
              <button className="quiet-button lifecycle-diagnostic" type="button" onClick={onCopyDiagnostic}>
                {diagnosticCopied ? <CheckCircle aria-hidden="true" /> : <Copy aria-hidden="true" />}
                {diagnosticCopied ? "Diagnostic copied" : "Copy safe diagnostic"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
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
  const [glyphRelayReady, setGlyphRelayReady] = useState(false);
  const [glyphRelayPreparing, setGlyphRelayPreparing] = useState(false);
  const [glyphDiagnosticCopied, setGlyphDiagnosticCopied] = useState(false);
  const activeGlyphRequestId = useRef<string | null>(null);
  const freshRetrySessionReady = useRef(false);

  useEffect(() => {
    const receiveFeedback = (event: Event) => {
      const feedback = (event as CustomEvent<GlyphRequestFeedback>).detail;
      if (feedback.state === "opening") {
        activeGlyphRequestId.current = feedback.requestId;
        freshRetrySessionReady.current = false;
        setGlyphDiagnosticCopied(false);
      } else if (activeGlyphRequestId.current && activeGlyphRequestId.current !== feedback.requestId) {
        return;
      }
      setGlyphFeedback(feedback);
    };

    window.addEventListener(GLYPH_REQUEST_STATUS_EVENT, receiveFeedback);
    return () => {
      window.removeEventListener(GLYPH_REQUEST_STATUS_EVENT, receiveFeedback);
    };
  }, []);

  const activeDetail = useMemo(
    () => (wallet.activeConnector ? connectorDetail(wallet.activeConnector.id) : null),
    [wallet.activeConnector],
  );

  const prepareGlyphRelayForIntent = useCallback((fresh = false, onReady?: () => void) => {
    const ready = isGlyphRelaySessionReady();
    setGlyphRelayReady(ready);
    if (ready && !fresh) {
      setGlyphRelayPreparing(false);
      return;
    }

    setGlyphRelayPreparing(true);
    if (fresh) setGlyphRelayReady(false);
    setActionError(null);
    void (fresh ? prepareFreshGlyphRelaySession() : prewarmGlyphRelaySession())
      .then(() => {
        setGlyphRelayReady(true);
        setGlyphRelayPreparing(false);
        onReady?.();
      })
      .catch(() => {
        setGlyphRelayReady(false);
        setGlyphRelayPreparing(false);
        setActionError(glyphFailureMessage("preparation_failed"));
      });
  }, []);

  const glyphConnectIntentHandlers = useMemo(
    () => createGlyphRequestIntentHandlers(prepareGlyphRelayForIntent),
    [prepareGlyphRelayForIntent],
  );

  const glyphActionIntentHandlers = useMemo(
    () => createGlyphRequestIntentHandlers(() => {
      if (wallet.activeConnector?.id === "glyph-wallet") prepareGlyphRelayForIntent();
    }),
    [prepareGlyphRelayForIntent, wallet.activeConnector?.id],
  );

  function openConnectorModal() {
    setActionError(null);
    setPairingUri(null);
    dialogRef.current?.showModal();
    setGlyphRelayReady(isGlyphRelaySessionReady());
  }

  function closeConnectorModal() {
    if (pendingId) return;
    dialogRef.current?.close();
    connectButtonRef.current?.focus();
  }

  async function connect(connectorId: string, freshRetry = false) {
    if (connectorId === "glyph-wallet" && (freshRetry || !isGlyphRelaySessionReady())) {
      prepareGlyphRelayForIntent(freshRetry);
      return;
    }
    setPendingId(connectorId);
    if (connectorId === "glyph-wallet") {
      setGlyphRelayReady(false);
      setGlyphRelayPreparing(false);
    }
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

  async function signMessage(freshRetry = false) {
    if (wallet.activeConnector?.id === "glyph-wallet" && (freshRetry || !isGlyphRelaySessionReady())) {
      prepareGlyphRelayForIntent(freshRetry);
      return;
    }
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

  async function sendTransfer(freshRetry = false) {
    if (!wallet.activeConnector) return;
    if (wallet.activeConnector.id === "glyph-wallet" && (freshRetry || !isGlyphRelaySessionReady())) {
      prepareGlyphRelayForIntent(freshRetry);
      return;
    }
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

  async function verifyMessageSignature(freshRetry = false) {
    if (!wallet.account || !wallet.activeConnector) return;
    if (wallet.activeConnector.id === "glyph-wallet" && (freshRetry || !isGlyphRelaySessionReady())) {
      prepareGlyphRelayForIntent(freshRetry);
      return;
    }
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

  function retryGlyphRequest() {
    const requestType = glyphFeedback?.requestType;
    if (!glyphFeedback || !isGlyphRequestRetryable(glyphFeedback.state)) return;
    setActionError(null);
    if (!freshRetrySessionReady.current) {
      prepareGlyphRelayForIntent(true, () => {
        freshRetrySessionReady.current = true;
      });
      return;
    }
    freshRetrySessionReady.current = false;
    if (requestType === "connect") {
      void connect("glyph-wallet");
    } else if (requestType === "transfer") {
      void sendTransfer();
    } else if (requestType === "sign_message") {
      void signMessage();
    } else if (requestType === "verify_message") {
      void verifyMessageSignature();
    }
  }

  async function copyGlyphDiagnostic() {
    if (!glyphFeedback) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(buildGlyphSafeDiagnostic(glyphFeedback));
      setGlyphDiagnosticCopied(true);
      window.setTimeout(() => setGlyphDiagnosticCopied(false), 1800);
    } catch {
      setActionError("Could not copy the safe diagnostic. Check clipboard permissions and try again.");
    }
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
        <section className="wallet-panel" aria-labelledby="wallet-state-title">
          {wallet.account && activeDetail ? (
            <>
              <div className="state-block">
                <div className="wallet-mark connected"><activeDetail.Icon aria-hidden="true" /></div>
                <p className="state-label"><CheckCircle aria-hidden="true" /> {activeDetail.label}</p>
                <h1 id="wallet-state-title">Connected</h1>
              </div>
              <button className="identity" type="button" onClick={copyIdentity} title={wallet.account.identity}>
                <Key aria-hidden="true" />
                <span>{shortIdentity(wallet.account.identity)}</span>
                {copied ? <CheckCircle aria-label="Copied" /> : <Copy aria-label="Copy identity" />}
              </button>

              <div className="section-divider" aria-hidden="true" />

              <div className="wallet-actions" role="tablist" aria-label="Wallet actions">
                <button type="button" role="tab" aria-selected={activeAction === "transfer"} className={activeAction === "transfer" ? "active" : ""} onClick={() => setActiveAction("transfer")}><SendSquare aria-hidden="true" />Transfer</button>
                <button type="button" role="tab" aria-selected={activeAction === "sign"} className={activeAction === "sign" ? "active" : ""} onClick={() => setActiveAction("sign")}><Pen aria-hidden="true" />Sign</button>
                <button type="button" role="tab" aria-selected={activeAction === "verify"} className={activeAction === "verify" ? "active" : ""} onClick={() => setActiveAction("verify")}><ShieldCheck aria-hidden="true" />Verify</button>
              </div>

              <div className="action-area" aria-live="polite">
                {activeAction === "transfer" && (
                  <form {...glyphActionIntentHandlers} onSubmit={(event) => { event.preventDefault(); void sendTransfer(); }}>
                    <p className="action-note">Real mainnet transfer. The wallet must approve it.</p>
                    <label htmlFor="destination">Destination identity</label>
                    <input id="destination" value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="60-character Qubic identity" />
                    <label htmlFor="amount">Amount</label>
                    <input id="amount" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} />
                    <button className="button" type="submit" disabled={isTransferring || !destination.trim() || !amount.trim()}>
                      {isTransferring ? <LoadingIcon /> : <SendSquare aria-hidden="true" />}
                      {isTransferring ? "Waiting for approval" : glyphRelayPreparing ? "Preparing secure session" : "Request transfer"}
                    </button>
                    {transferResult && <p className="compact-result" role="status"><CheckCircle aria-hidden="true" />Transfer submitted: <code>{transferResult}</code></p>}
                  </form>
                )}

                {activeAction === "sign" && (
                  <form {...glyphActionIntentHandlers} onSubmit={(event) => { event.preventDefault(); void signMessage(); }}>
                    <label htmlFor="message">Message</label>
                    <textarea id="message" value={message} onChange={(event) => setMessage(event.target.value)} rows={2} />
                    <button className="button" type="submit" disabled={isSigning || !message.trim()}>
                      {isSigning ? <LoadingIcon /> : <Pen aria-hidden="true" />}
                      {isSigning ? "Waiting for approval" : glyphRelayPreparing ? "Preparing secure session" : "Sign message"}
                    </button>
                    {signature && <p className="compact-result" role="status"><CheckCircle aria-hidden="true" />Signature: <code>{signature}</code></p>}
                  </form>
                )}

                {activeAction === "verify" && (
                  <form {...glyphActionIntentHandlers} onSubmit={(event) => { event.preventDefault(); void verifyMessageSignature(); }}>
                    <p className="action-note">{wallet.activeConnector?.id === "glyph-wallet" ? "Glyph Wallet will display and verify this signature." : "This signature is verified locally against the connected identity."}</p>
                    <label htmlFor="verify-message">Message</label>
                    <textarea id="verify-message" value={message} onChange={(event) => setMessage(event.target.value)} rows={2} />
                    <label htmlFor="signature">Signature</label>
                    <textarea id="signature" value={verifySignature} onChange={(event) => setVerifySignature(event.target.value)} rows={2} placeholder="Hexadecimal signature" />
                    <button className="button" type="submit" disabled={isVerifying || !message.trim() || !verifySignature.trim()}>{isVerifying ? <LoadingIcon /> : <ShieldCheck aria-hidden="true" />}{isVerifying ? "Waiting for verification" : glyphRelayPreparing ? "Preparing secure session" : "Verify signature"}</button>
                    {verificationResult !== null && <p className={`compact-result ${verificationResult ? "valid" : "invalid"}`} role="status"><ShieldCheck aria-hidden="true" />{verificationResult ? "Signature is valid" : "Signature is not valid"}</p>}
                  </form>
                )}
              </div>

              <GlyphRequestLifecycle
                feedback={glyphFeedback}
                preparing={glyphRelayPreparing}
                onRetry={retryGlyphRequest}
                onCopyDiagnostic={() => void copyGlyphDiagnostic()}
                diagnosticCopied={glyphDiagnosticCopied}
              />

              <button className="quiet-button" type="button" onClick={disconnect} disabled={Boolean(pendingId)}>
                {pendingId ? <LoadingIcon /> : <Logout aria-hidden="true" />}
                Disconnect wallet
              </button>
            </>
          ) : (
            <>
              <div className="state-block">
                <div className="wallet-mark"><Wallet aria-hidden="true" /></div>
                <p className="state-label">Qubic wallet</p>
                <h1 id="wallet-state-title">Connect with calm</h1>
                <p className="state-copy">Choose a connector. Approval stays in the wallet.</p>
              </div>
              <button
                ref={connectButtonRef}
                className="button connect-button"
                type="button"
                onPointerEnter={glyphConnectIntentHandlers.onPointerEnter}
                onFocus={glyphConnectIntentHandlers.onFocus}
                onTouchStart={glyphConnectIntentHandlers.onTouchStart}
                onClick={() => {
                  openConnectorModal();
                  glyphConnectIntentHandlers.onClick();
                }}
              >
                <PlugCircle aria-hidden="true" />
                Connect wallet
              </button>
              <GlyphRequestLifecycle
                feedback={glyphFeedback}
                preparing={glyphRelayPreparing}
                onRetry={retryGlyphRequest}
                onCopyDiagnostic={() => void copyGlyphDiagnostic()}
                diagnosticCopied={glyphDiagnosticCopied}
              />
            </>
          )}

          {(actionError || wallet.error) && !(glyphFeedback && isGlyphRequestRetryable(glyphFeedback.state)) && (
            <div className="error-message" role="alert">
              <ShieldCheck aria-hidden="true" />
              <p>{actionError ?? "The wallet connector reported a failure. Try the request again."}</p>
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
            <button className="icon-button" type="button" onClick={closeConnectorModal} disabled={Boolean(pendingId)} aria-label="Close connector selection">
              <CloseCircle aria-hidden="true" />
            </button>
          </div>

          <div className="connector-list">
            {wallet.connectors.map((connector) => {
              const detail = connectorDetail(connector.id);
              const available = mounted && connectorAvailable(connector);
              const needsProjectId = connector.id === "walletconnect" && !hasWalletConnectProjectId;
              const glyphPreparing = connector.id === "glyph-wallet" && !glyphRelayReady;
              const disabled = Boolean(pendingId) || !available || needsProjectId;
              const Icon = detail.Icon;
              return (
                <button
                  className="connector-option"
                  disabled={disabled}
                  key={connector.id}
                  {...(connector.id === "glyph-wallet" ? glyphConnectIntentHandlers : {})}
                  onClick={() => connect(connector.id)}
                  type="button"
                >
                  <span className="connector-icon"><Icon aria-hidden="true" /></span>
                  <span className="connector-copy">
                    <strong>{detail.label}</strong>
                    <span>{detail.description}</span>
                    <small className={available && !needsProjectId ? "ready" : ""}>
                      {needsProjectId
                        ? "Configuration required"
                        : glyphPreparing
                          ? glyphRelayPreparing
                            ? "Preparing secure session"
                            : "Click to prepare secure session"
                          : available
                            ? "Ready"
                            : detail.requirement ?? "Unavailable"}
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

          {pendingId === "glyph-wallet" && (
            <GlyphRequestLifecycle
              feedback={glyphFeedback}
              preparing={glyphRelayPreparing}
              onRetry={retryGlyphRequest}
              onCopyDiagnostic={() => void copyGlyphDiagnostic()}
              diagnosticCopied={glyphDiagnosticCopied}
            />
          )}

          {actionError && <p className="dialog-error" role="alert">{actionError}</p>}
        </div>
      </dialog>
    </div>
  );
}
