"use client";

import { useTickInfo, useWallet } from "@qubic.org/react";
import {
  CheckCircle,
  Code2,
  Copy,
  Global,
  Key,
  Logout,
  Monitor,
  Pen,
  PlugCircle,
  RefreshCircle,
  ShieldCheck,
  Smartphone,
  Wallet,
} from "@solar-icons/react";
import { QRCodeSVG } from "qrcode.react";
import { useMemo, useState, useSyncExternalStore, type ComponentType, type SVGProps } from "react";
import { hasWalletConnectProjectId } from "@/lib/connectors";

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
  "metamask-snap": {
    label: "MetaMask Snap",
    description: "Connect through the Qubic Snap in MetaMask Flask.",
    Icon: ShieldCheck,
    requirement: "MetaMask Flask required",
  },
};

function shortIdentity(identity: string) {
  return `${identity.slice(0, 10)}…${identity.slice(-10)}`;
}

function LoadingIcon() {
  return <span className="spinner spinner-small" aria-hidden="true" />;
}

export function StarterApp() {
  const wallet = useWallet();
  const tickInfo = useTickInfo(5000, { retry: 1 });
  const mounted = useSyncExternalStore(() => () => undefined, () => true, () => false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pairingUri, setPairingUri] = useState<string | null>(null);
  const [message, setMessage] = useState("Confirm access to Glyph Qubic Starter");
  const [signature, setSignature] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSigning, setIsSigning] = useState(false);

  const activeDetail = useMemo(
    () => (wallet.activeConnector ? connectorDetails[wallet.activeConnector.id] : null),
    [wallet.activeConnector],
  );

  async function connect(connectorId: string) {
    setPendingId(connectorId);
    setPairingUri(null);
    setActionError(null);
    try {
      await wallet.connect(connectorId, {
        onUri: (uri) => setPairingUri(uri),
      });
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
      setPairingUri(null);
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
        <div className="product-name">
          <span>Qubic starter</span>
          <span className="environment">mainnet</span>
        </div>
        <a className="header-link" href="https://docs.glyphq.org">
          <Code2 aria-hidden="true" />
          Docs
        </a>
      </header>

      <main className="workspace">
        <section className="intro" aria-labelledby="page-title">
          <div>
            <p className="eyebrow">Multi-wallet reference implementation</p>
            <h1 id="page-title">Connect a Qubic wallet.</h1>
            <p className="intro-copy">
              A working starter for the official Qubic React connectors, with Glyph Wallet added through Glyph Connect.
            </p>
          </div>
          <div className="network-chip" aria-live="polite">
            <span className={tickInfo.isSuccess ? "network-dot online" : "network-dot"} />
            <span>Current tick</span>
            <strong>{tickInfo.data?.tick?.toLocaleString() ?? "Checking"}</strong>
          </div>
        </section>

        <div className="app-grid">
          <section className="panel connector-panel" aria-labelledby="connectors-title">
            <div className="panel-heading">
              <div>
                <p className="section-label">01 / Connectors</p>
                <h2 id="connectors-title">Choose a connection path</h2>
              </div>
              <span className="count">{wallet.connectors.length.toString().padStart(2, "0")}</span>
            </div>

            <div className="connector-list">
              {wallet.connectors.map((connector) => {
                const detail = connectorDetails[connector.id];
                const available = mounted && connector.isAvailable();
                const isWalletConnectDisabled = connector.id === "walletconnect" && !hasWalletConnectProjectId;
                const disabled = Boolean(pendingId) || !available || isWalletConnectDisabled;
                const selected = wallet.activeConnector?.id === connector.id;
                const Icon = detail.Icon;
                return (
                  <article className={`connector-row${selected ? " selected" : ""}`} key={connector.id}>
                    <div className="connector-icon"><Icon aria-hidden="true" /></div>
                    <div className="connector-copy">
                      <div className="connector-title-line">
                        <h3>{detail.label}</h3>
                        {selected && <span className="status success">Connected</span>}
                      </div>
                      <p>{detail.description}</p>
                      {!selected && (
                        <span className={`availability${available && !isWalletConnectDisabled ? " ready" : ""}`}>
                          {isWalletConnectDisabled
                            ? "Configuration required"
                            : available
                              ? "Ready"
                              : detail.requirement ?? "Unavailable"}
                        </span>
                      )}
                    </div>
                    <button
                      className="button button-secondary connector-action"
                      disabled={disabled || selected}
                      onClick={() => connect(connector.id)}
                    >
                      {pendingId === connector.id ? <LoadingIcon /> : <PlugCircle aria-hidden="true" />}
                      {selected ? "Connected" : "Connect"}
                    </button>
                    {connector.id === "walletconnect" && pairingUri && (
                      <div className="pairing" role="status">
                        <div className="qr-frame"><QRCodeSVG value={pairingUri} size={176} /></div>
                        <div>
                          <strong>Scan with your wallet</strong>
                          <p>Keep this page open while the wallet approves the session.</p>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          <aside className="right-column">
            <section className="panel account-panel" aria-labelledby="account-title">
              <div className="panel-heading compact">
                <div>
                  <p className="section-label">02 / Session</p>
                  <h2 id="account-title">Wallet state</h2>
                </div>
                <Key aria-hidden="true" className="heading-icon" />
              </div>

              {wallet.account && activeDetail ? (
                <div className="connected-state">
                  <div className="account-badge"><activeDetail.Icon aria-hidden="true" /></div>
                  <p className="connected-label"><CheckCircle aria-hidden="true" /> Connected with {activeDetail.label}</p>
                  <strong className="identity" title={wallet.account.identity}>{shortIdentity(wallet.account.identity)}</strong>
                  <div className="session-actions">
                    <button className="button" onClick={copyIdentity}>
                      {copied ? <CheckCircle aria-hidden="true" /> : <Copy aria-hidden="true" />}
                      {copied ? "Copied" : "Copy identity"}
                    </button>
                    <button className="button button-secondary" onClick={disconnect} disabled={Boolean(pendingId)}>
                      {pendingId ? <LoadingIcon /> : <Logout aria-hidden="true" />}
                      Disconnect
                    </button>
                  </div>
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-mark"><Wallet aria-hidden="true" /></div>
                  <h3>No wallet connected</h3>
                  <p>Select a connector to expose the active identity and signing controls.</p>
                </div>
              )}
            </section>

            <section className="panel network-panel" aria-labelledby="network-title">
              <div className="panel-heading compact">
                <div>
                  <p className="section-label">03 / Network</p>
                  <h2 id="network-title">Live Qubic state</h2>
                </div>
                <Global aria-hidden="true" className="heading-icon" />
              </div>
              <dl className="metrics">
                <div><dt>Status</dt><dd>{tickInfo.isSuccess ? "Connected" : tickInfo.isError ? "Unavailable" : "Checking"}</dd></div>
                <div><dt>Tick</dt><dd>{tickInfo.data?.tick?.toLocaleString() ?? "•••••••"}</dd></div>
                <div><dt>Epoch</dt><dd>{tickInfo.data?.epoch?.toLocaleString() ?? "•••"}</dd></div>
              </dl>
              <button className="quiet-button" onClick={() => tickInfo.refetch()} disabled={tickInfo.isFetching}>
                {tickInfo.isFetching ? <LoadingIcon /> : <RefreshCircle aria-hidden="true" />}
                Refresh network state
              </button>
            </section>
          </aside>
        </div>

        <section className="panel signing-panel" aria-labelledby="sign-title">
          <div className="signing-copy">
            <p className="section-label">04 / Approval</p>
            <h2 id="sign-title">Test message signing</h2>
            <p>Request a signature from the active wallet. The wallet remains the user approval boundary.</p>
          </div>
          <div className="signing-form">
            <label htmlFor="message">Message</label>
            <textarea id="message" value={message} onChange={(event) => setMessage(event.target.value)} rows={3} />
            <button className="button" onClick={signMessage} disabled={!wallet.isConnected || isSigning || !message.trim()}>
              {isSigning ? <LoadingIcon /> : <Pen aria-hidden="true" />}
              {isSigning ? "Waiting for approval" : "Request signature"}
            </button>
            {signature && (
              <div className="signature-result" role="status">
                <CheckCircle aria-hidden="true" />
                <div><strong>Signature received</strong><code>{signature}</code></div>
              </div>
            )}
          </div>
        </section>

        {(actionError || wallet.error) && (
          <div className="error-banner" role="alert">
            <ShieldCheck aria-hidden="true" />
            <div><strong>The request did not complete</strong><p>{actionError ?? wallet.error?.message}</p></div>
          </div>
        )}
      </main>

      <footer className="footer">
        <p>Independent software built for Qubic. Glyph is not an official Qubic organization.</p>
        <a href="https://github.com/glyphq">GitHub</a>
      </footer>
    </div>
  );
}
