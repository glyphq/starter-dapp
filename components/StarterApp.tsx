"use client";

import {
  buildRandomLotteryBuyTicketRequest,
  fetchRandomLotteryPreflight,
  formatRandomLotteryTicketPrice,
  type RandomLotteryPreflight,
} from "@/lib/contracts/random-lottery";
import {
  pollRandomLotteryPurchaseConfirmation,
  pendingRandomLotteryPurchase,
  QUBIC_EXPLORER_TRANSACTION_URL,
  type RandomLotteryPurchaseConfirmation,
} from "@/lib/contracts/random-lottery-result";
import { identityToPublicKey, k12, verify } from "@qubic.org/crypto";
import { useWallet } from "@qubic.org/react";
import Image from "next/image";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  CheckmarkCircle02Icon,
  Copy01Icon,
  Logout01Icon,
  Moon02Icon,
  Pen01Icon,
  SecurityCheckIcon,
  Sun02Icon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { hasWalletConnectProjectId } from "@/lib/connectors";
import {
  GLYPH_REQUEST_STATUS_EVENT,
  glyphRequestMilestoneLabel,
  isGlyphRelaySessionReady,
  prepareFreshGlyphRelaySession,
  prewarmGlyphRelaySession,
  requestGlyphScCall,
  requestGlyphVerification,
  type GlyphRequestFeedback,
} from "@/lib/connectors/glyph";

type Theme = "dark" | "light";
type Flow = "connect" | "random-lottery" | "sign-verify";
type Icon = IconSvgElement;

export const referenceFlows = [
  { id: "connect", label: "Connect" },
  { id: "random-lottery", label: "RandomLottery" },
  { id: "sign-verify", label: "Sign & Verify" },
] as const satisfies ReadonlyArray<{ id: Flow; label: string }>;

/**
 * Chromium can reject an internal navigation while it hands a custom `glyph:`
 * URL to the operating system. The link launch itself still succeeds, so this
 * exact browser-only rejection must not become an application error.
 */
export function isGlyphLaunchAbort(reason: unknown) {
  if (!reason || typeof reason !== "object") return false;
  const candidate = reason as { name?: unknown; message?: unknown };
  return candidate.name === "AbortError" && candidate.message === "The user aborted a request.";
}

const THEME_STORAGE_KEY = "qubic-starter-theme";
const THEME_CHANGE_EVENT = "qubic-starter-theme-change";

function HugeIcon({ icon, size = 16, className }: { icon: Icon; size?: number; className?: string }) {
  return <HugeiconsIcon icon={icon} size={size} strokeWidth={1.8} className={className} aria-hidden="true" />;
}

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  return saved === "light" || saved === "dark" ? saved : "dark";
}

function subscribeToTheme(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
  };
}

function connectorAvailable(connector: { isAvailable: () => boolean }) {
  try {
    return connector.isAvailable();
  } catch {
    return false;
  }
}

function shortIdentity(identity: string) {
  return `${identity.slice(0, 8)}…${identity.slice(-8)}`;
}

function connectorLabel(id: string) {
  if (id === "glyph-wallet") return "Glyph Wallet";
  if (id === "qubic-extension") return "Qubic Extension";
  if (id === "walletconnect") return "WalletConnect";
  return id;
}

function hexToBytes(value: string) {
  const normalized = value.trim();
  if (!/^[0-9a-fA-F]+$/.test(normalized) || normalized.length % 2 !== 0) {
    throw new Error("Enter a complete hexadecimal signature.");
  }
  return Uint8Array.from(normalized.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16));
}

function safeErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && [
    "Enter a complete hexadecimal signature.",
    "Enter a valid Qubic identity.",
    "Enter a message to sign.",
  ].includes(error.message)) {
    return error.message;
  }
  return fallback;
}

function LoadingIcon() {
  return <span className="spinner" aria-hidden="true" />;
}

function ConnectorMark({ connectorId }: { connectorId: string }) {
  if (connectorId === "glyph-wallet") {
    return <Image className="glyph-mark connector-mark" src="/brand/glyph-mark.png" alt="" width={20} height={20} unoptimized />;
  }
  return <HugeIcon icon={Wallet01Icon} />;
}

function AccountMenu({
  identity,
  connector,
  copied,
  onCopy,
  onDisconnect,
  disabled,
}: {
  identity: string;
  connector: string;
  copied: boolean;
  onCopy: () => void;
  onDisconnect: () => void;
  disabled: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="identity-trigger" aria-label="Open connected identity menu" />}>
        <span className="status-dot online" aria-hidden="true" />
        <code title={identity}>{shortIdentity(identity)}</code>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="identity-menu">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Connected identity</DropdownMenuLabel>
          <div className="identity-menu-details">
            <code>{identity}</code>
            <span>Using {connectorLabel(connector)}</span>
          </div>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={onCopy}>
            <HugeIcon icon={copied ? CheckmarkCircle02Icon : Copy01Icon} />
            {copied ? "Copied identity" : "Copy identity"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onDisconnect} disabled={disabled} variant="destructive">
            <HugeIcon icon={Logout01Icon} />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FlowHeading({ id, title, description }: { id: string; title: string; description: string }) {
  return (
    <div className="flow-heading">
      <h2 id={id}>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

function WalletChoice({
  connector,
  pendingId,
  glyphRelayPreparing,
  onConnect,
}: {
  connector: { id: string };
  pendingId: string | null;
  glyphRelayPreparing: boolean;
  onConnect: (id: string) => void;
}) {
  const pending = pendingId === connector.id;
  const isGlyph = connector.id === "glyph-wallet";
  return (
    <Button
      variant="outline"
      className="connector-choice"
      onClick={() => onConnect(connector.id)}
      disabled={Boolean(pendingId) || (isGlyph && glyphRelayPreparing)}
    >
      <span className="connector-choice-mark"><ConnectorMark connectorId={connector.id} /></span>
      <span className="connector-choice-copy">
        <strong>{connectorLabel(connector.id)}</strong>
        <small>{isGlyph && glyphRelayPreparing ? "Preparing secure session" : isGlyph ? "Secure Glyph relay" : "Browser wallet connector"}</small>
      </span>
      {pending || (isGlyph && glyphRelayPreparing) ? <LoadingIcon /> : null}
    </Button>
  );
}

function RequestStatus({ feedback, preparing }: { feedback: GlyphRequestFeedback | null; preparing: boolean }) {
  const state = preparing ? "preparing" : feedback?.state;
  if (!state || state === "completed" || state === "failed" || state === "interrupted") return null;
  return (
    <div className="request-status" role="status" aria-live="polite">
      <span className="request-status-icon"><LoadingIcon /></span>
      <span>
        <strong>{glyphRequestMilestoneLabel(state)}</strong>
        <small>{state === "awaiting_approval" ? "Approve the request in your wallet." : "Secure wallet request in progress."}</small>
      </span>
    </div>
  );
}

function RandomLotteryPurchaseStatus({ confirmation }: { confirmation: RandomLotteryPurchaseConfirmation | null }) {
  if (!confirmation) return null;
  const explorerUrl = QUBIC_EXPLORER_TRANSACTION_URL(confirmation.transactionId);

  return (
    <div className={`lottery-confirmation ${confirmation.state}`} role="status" aria-live="polite">
      <div className="lottery-confirmation-heading">
        {confirmation.state === "pending" ? <LoadingIcon /> : null}
        <strong>
          {confirmation.state === "pending"
            ? "Waiting for network confirmation"
            : confirmation.state === "confirmed"
              ? "Transaction confirmed"
              : "Archive status unavailable"}
        </strong>
      </div>
      {confirmation.state === "pending" ? (
        <p>Glyph signed the BuyTicket call. The official Qubic archive is being checked.</p>
      ) : confirmation.state === "confirmed" ? (
        <>
          <div className="lottery-confirmation-data">
            {confirmation.tickNumber !== undefined && <><span>Confirmed tick</span><code>{confirmation.tickNumber}</code></>}
            {confirmation.moneyFlew !== undefined && <><span>Archive money-flow signal</span><code>{confirmation.moneyFlew ? "funds moved" : "no funds moved"}</code></>}
          </div>
          <p>The official archive indexed this empty-payload BuyTicket call. Its public schema does not expose the contract return code, so this app does not claim an accepted or refunded entry.</p>
        </>
      ) : (
        <p>{confirmation.message}</p>
      )}
      <a href={explorerUrl} target="_blank" rel="noreferrer">View transaction in Qubic Explorer</a>
    </div>
  );
}

export function StarterApp() {
  const wallet = useWallet();
  const theme = useSyncExternalStore<Theme>(subscribeToTheme, readStoredTheme, () => "dark");
  const [flow, setFlow] = useState<Flow>("connect");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pairingUri, setPairingUri] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [glyphFeedback, setGlyphFeedback] = useState<GlyphRequestFeedback | null>(null);
  const [glyphRelayPreparing, setGlyphRelayPreparing] = useState(false);
  const [copiedIdentity, setCopiedIdentity] = useState(false);
  const [message, setMessage] = useState("Hello from Qubic.");
  const [verifySignature, setVerifySignature] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<boolean | null>(null);
  const [activeSignTab, setActiveSignTab] = useState<"sign" | "verify">("sign");
  const [lotteryPreflight, setLotteryPreflight] = useState<RandomLotteryPreflight | null>(null);
  const [lotteryPreflightLoading, setLotteryPreflightLoading] = useState(false);
  const [lotteryConfirmation, setLotteryConfirmation] = useState<RandomLotteryPurchaseConfirmation | null>(null);
  const lotteryPollController = useRef<AbortController | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const suppressGlyphLaunchAbort = (event: PromiseRejectionEvent) => {
      if (isGlyphLaunchAbort(event.reason)) event.preventDefault();
    };
    // The root-layout guard is installed before hydration. Keep this client
    // listener for navigation after client transitions replace the document.
    window.addEventListener("unhandledrejection", suppressGlyphLaunchAbort, { capture: true });
    return () => window.removeEventListener("unhandledrejection", suppressGlyphLaunchAbort, { capture: true });
  }, []);

  useEffect(() => () => lotteryPollController.current?.abort(), []);

  useEffect(() => {
    const onStatus = (event: Event) => {
      const detail = (event as CustomEvent<GlyphRequestFeedback>).detail;
      if (detail.state === "completed") {
        setGlyphFeedback(null);
        return;
      }
      setGlyphFeedback(detail);
    };
    window.addEventListener(GLYPH_REQUEST_STATUS_EVENT, onStatus);
    return () => window.removeEventListener(GLYPH_REQUEST_STATUS_EVENT, onStatus);
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
    document.documentElement.dataset.theme = next;
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  };

  const prepareGlyphRelayForIntent = useCallback((fresh = false) => {
    if (glyphRelayPreparing) return;
    setGlyphRelayPreparing(true);
    setActionError(null);
    void (fresh ? prepareFreshGlyphRelaySession() : prewarmGlyphRelaySession())
      .then(() => {
        setGlyphRelayPreparing(false);
      })
      .catch(() => {
        setGlyphRelayPreparing(false);
        setActionError("The secure Glyph session could not be prepared. Try again.");
        toast.error("Wallet session preparation failed", { description: "Try the wallet request again." });
      });
  }, [glyphRelayPreparing]);

  function openConnectorModal() {
    setActionError(null);
    setPairingUri(null);
    setDialogOpen(true);
    // This is an explicit request to choose a wallet, not incidental pointer
    // activity. Preparing here gives the connector choice time to become
    // ready without creating sessions on hover or focus.
    prepareGlyphRelayForIntent();
  }

  async function connect(connectorId: string, freshRetry = false) {
    if (connectorId === "glyph-wallet" && (freshRetry || !isGlyphRelaySessionReady())) {
      // A custom protocol must be launched from a live user gesture. Never
      // retry this asynchronously after relay registration because browsers
      // can abort the handoff once that gesture has ended.
      prepareGlyphRelayForIntent(freshRetry);
      return;
    }
    setPendingId(connectorId);
    setPairingUri(null);
    setActionError(null);
    try {
      await wallet.connect(connectorId, { onUri: setPairingUri });
      setDialogOpen(false);
      toast.success("Wallet connected");
    } catch {
      setActionError("The wallet could not be connected. Try again.");
      toast.error("Wallet connection failed", { description: "Try the request again." });
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
      setVerificationResult(null);
      toast.success("Wallet disconnected");
    } catch {
      setActionError("The wallet could not disconnect. Try again.");
      toast.error("Disconnect failed", { description: "Try again." });
    } finally {
      setPendingId(null);
    }
  }

  async function copyIdentity() {
    if (!wallet.account) return;
    try {
      await navigator.clipboard.writeText(wallet.account.identity);
      setCopiedIdentity(true);
      window.setTimeout(() => setCopiedIdentity(false), 1800);
      toast.success("Identity copied");
    } catch {
      toast.error("Copy failed", { description: "Try again." });
    }
  }

  async function signMessage() {
    if (!wallet.account || !wallet.activeConnector) return;
    if (wallet.activeConnector.id === "glyph-wallet" && !isGlyphRelaySessionReady()) {
      prepareGlyphRelayForIntent();
      return;
    }
    if (!message.trim()) {
      setActionError("Enter a message to sign.");
      return;
    }
    setIsBusy(true);
    setActionError(null);
    setSignature(null);
    try {
      const result = await wallet.signMessage(message);
      setSignature(result.signatureHex);
      toast.success("Message signed");
    } catch {
      setActionError("The message could not be signed. Try again.");
      toast.error("Signing failed", { description: "Try the request again." });
    } finally {
      setIsBusy(false);
    }
  }

  async function verifyMessageSignature() {
    if (!wallet.account || !wallet.activeConnector) return;
    if (wallet.activeConnector.id === "glyph-wallet" && !isGlyphRelaySessionReady()) {
      prepareGlyphRelayForIntent();
      return;
    }
    setIsBusy(true);
    setActionError(null);
    setVerificationResult(null);
    try {
      const result = wallet.activeConnector.id === "glyph-wallet"
        ? await requestGlyphVerification(message, verifySignature)
        : verify(k12(new TextEncoder().encode(message), 32), hexToBytes(verifySignature), identityToPublicKey(wallet.account.identity));
      setVerificationResult(result);
      toast.success(result ? "Signature verified" : "Signature is not valid");
    } catch (error) {
      setActionError(safeErrorMessage(error, "The signature could not be verified. Check the inputs."));
      toast.error("Verification failed", { description: "Check the inputs and try again." });
    } finally {
      setIsBusy(false);
    }
  }

  const refreshRandomLotteryPreflight = useCallback(async () => {
    setLotteryPreflightLoading(true);
    try {
      const preflight = await fetchRandomLotteryPreflight();
      setLotteryPreflight(preflight);
      return preflight;
    } catch {
      const unavailable: RandomLotteryPreflight = {
        state: "unavailable",
        message: "Live RandomLottery price or selling state is unavailable. Try again shortly.",
      };
      setLotteryPreflight(unavailable);
      return unavailable;
    } finally {
      setLotteryPreflightLoading(false);
    }
  }, []);

  useEffect(() => {
    if (flow === "random-lottery") void Promise.resolve().then(refreshRandomLotteryPreflight);
  }, [flow, refreshRandomLotteryPreflight]);

  async function buyRandomLotteryTicket() {
    if (wallet.activeConnector?.id !== "glyph-wallet") {
      setActionError("Connect Glyph Wallet to buy a RandomLottery ticket.");
      return;
    }
    if (!isGlyphRelaySessionReady()) {
      prepareGlyphRelayForIntent();
      return;
    }
    setIsBusy(true);
    setActionError(null);
    lotteryPollController.current?.abort();
    setLotteryConfirmation(null);
    try {
      // Re-read both official live functions at the launch point. The displayed
      // price is advisory until this check succeeds because state and price can
      // change between rendering and wallet approval.
      const preflight = await refreshRandomLotteryPreflight();
      if (preflight.state !== "open") {
        throw new Error(preflight.state === "closed"
          ? "RandomLottery ticket selling is currently closed."
          : preflight.message);
      }

      const { txId, targetTick } = await requestGlyphScCall(buildRandomLotteryBuyTicketRequest(preflight.ticketPrice));
      const pendingConfirmation = pendingRandomLotteryPurchase(txId, targetTick);
      setLotteryConfirmation(pendingConfirmation);
      const controller = new AbortController();
      lotteryPollController.current = controller;
      void pollRandomLotteryPurchaseConfirmation({
        transactionId: txId,
        ticketPrice: preflight.ticketPrice,
        targetTick,
        signal: controller.signal,
        onUpdate: setLotteryConfirmation,
      }).catch(() => {
        if (!controller.signal.aborted) {
          setLotteryConfirmation({
            state: "unavailable",
            transactionId: txId,
            message: "The official Qubic archive could not be read. Check the transaction in Explorer.",
          });
        }
      });
      toast.success("Lottery purchase signed", {
        description: "Waiting for official transaction confirmation.",
      });
    } catch (error) {
      const message = error instanceof Error && [
        "RandomLottery ticket selling is currently closed.",
        "Live RandomLottery price or selling state is unavailable. Try again shortly.",
        "RandomLottery returned an invalid live ticket price. No purchase can be requested.",
      ].includes(error.message)
        ? error.message
        : "The ticket purchase was not approved. No chain result is shown.";
      setActionError(message);
      toast.error("Ticket purchase failed", { description: message });
    } finally {
      setIsBusy(false);
    }
  }

  const connected = Boolean(wallet.account && wallet.activeConnector);
  const availableConnectors = wallet.connectors.filter((connector) => connectorAvailable(connector) && !(connector.id === "walletconnect" && !hasWalletConnectProjectId));
  const errorMessage = actionError || (wallet.error ? "The wallet request could not be completed. Try again." : null);

  return (
    <TooltipProvider>
      <Toaster theme={theme} />
      <div className="workspace-shell">
        <header className="workspace-header">
          <div className="workspace-brand">
            <Image className="glyph-mark workspace-brand-mark" src="/brand/glyph-mark.png" alt="Glyph" width={24} height={24} unoptimized />
            <h1>Wallet flows for Qubic</h1>
          </div>
          <div className="workspace-header-actions">
            <Tooltip>
              <TooltipTrigger render={<Button variant="ghost" size="icon" type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} />}>
                <HugeIcon icon={theme === "dark" ? Sun02Icon : Moon02Icon} />
              </TooltipTrigger>
              <TooltipContent>{`Switch to ${theme === "dark" ? "light" : "dark"} theme`}</TooltipContent>
            </Tooltip>
            {wallet.account && wallet.activeConnector ? (
              <AccountMenu identity={wallet.account.identity} connector={wallet.activeConnector.id} copied={copiedIdentity} onCopy={() => void copyIdentity()} onDisconnect={() => void disconnect()} disabled={Boolean(pendingId)} />
            ) : (
              <Button variant="outline" size="sm" onClick={() => { setFlow("connect"); openConnectorModal(); }}>
                <HugeIcon icon={Wallet01Icon} />
                Connect wallet
              </Button>
            )}
          </div>
        </header>

        <main className="workspace-main">
          <nav className="flow-nav" aria-label="Reference flows">
            {referenceFlows.map((item) => (
              <button key={item.id} type="button" className={`flow-nav-item ${flow === item.id ? "active" : ""}`} onClick={() => setFlow(item.id)} aria-current={flow === item.id ? "page" : undefined}>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="flow-stage">
            {flow === "connect" && (
              <section className="flow-panel" aria-labelledby="connect-title">
                <FlowHeading id="connect-title" title="Connect" description="Choose a wallet connector and establish an account session." />
                <div className="flow-rule" />
                {connected && wallet.account && wallet.activeConnector ? (
                  <div className="connected-state">
                    <div className="connected-state-copy">
                      <span className="status-dot online" aria-hidden="true" />
                      <div>
                        <strong>Wallet connected</strong>
                        <p>{connectorLabel(wallet.activeConnector.id)} is ready for requests.</p>
                      </div>
                    </div>
                    <div className="connected-identity"><span>Identity</span><code>{shortIdentity(wallet.account.identity)}</code></div>
                  </div>
                ) : (
                  <div className="connect-prompt">
                    <div>
                      <strong>Start with a wallet</strong>
                      <p>Only available connectors appear here. Glyph requests use the signed Relay v2 path.</p>
                    </div>
                    <Button
                      className="primary-button"
                      onClick={openConnectorModal}
                    >
                      <HugeIcon icon={Wallet01Icon} />Choose wallet
                    </Button>
                  </div>
                )}
                <RequestStatus feedback={glyphFeedback} preparing={glyphRelayPreparing} />
              </section>
            )}

            {flow === "random-lottery" && (
              <section className="flow-panel" aria-labelledby="random-lottery-title">
                <FlowHeading id="random-lottery-title" title="RandomLottery" description="Buy one live-priced ticket through the official RandomLottery contract." />
                <div className="flow-rule" />
                <div className="call-intro">
                  <div><span className="data-label">Live ticket price</span><code>{lotteryPreflight?.state === "open" || lotteryPreflight?.state === "closed" ? formatRandomLotteryTicketPrice(lotteryPreflight.ticketPrice) : lotteryPreflightLoading ? "Checking live contract…" : "Unavailable"}</code></div>
                  <div><span className="data-label">Selling state</span><code>{lotteryPreflight?.state === "open" ? "Open" : lotteryPreflight?.state === "closed" ? "Closed" : lotteryPreflightLoading ? "Checking…" : "Unavailable"}</code></div>
                  <div><span className="data-label">Procedure</span><code>BuyTicket · input type 1 · empty payload</code></div>
                </div>
                <form className="task-form" onSubmit={(event) => { event.preventDefault(); void buyRandomLotteryTicket(); }}>
                  <p className="contract-call-note">Paid lottery entry. Buying a ticket transfers the live displayed price to RandomLottery. Selling state and price are checked again immediately before Glyph opens.</p>
                  <div className="form-actions"><Button className="primary-button" type="submit" disabled={isBusy || lotteryPreflightLoading || lotteryPreflight?.state !== "open" || wallet.activeConnector?.id !== "glyph-wallet"}>{isBusy ? <LoadingIcon /> : <HugeIcon icon={SecurityCheckIcon} />}{isBusy ? "Checking live price…" : "Buy ticket"}</Button></div>
                  {lotteryPreflight?.state === "closed" && <p className="error-line" role="status">Ticket selling is currently closed. No wallet request can be launched.</p>}
                  {lotteryPreflight?.state === "unavailable" && <p className="error-line" role="status">{lotteryPreflight.message}</p>}
                  {wallet.activeConnector?.id !== "glyph-wallet" && <p className="error-line" role="status">Connect Glyph Wallet to buy a ticket.</p>}
                  <RandomLotteryPurchaseStatus confirmation={lotteryConfirmation} />
                  <RequestStatus feedback={glyphFeedback} preparing={glyphRelayPreparing} />
                </form>
              </section>
            )}

            {flow === "sign-verify" && (
              <section className="flow-panel" aria-labelledby="sign-verify-title">
                <FlowHeading id="sign-verify-title" title="Sign & Verify" description="Sign a message with the active wallet or verify a signature against its identity." />
                <div className="flow-rule" />
                {!connected ? (
                  <div className="connect-prompt compact-prompt">
                    <div><strong>Wallet required</strong><p>Connect a wallet before sending a signing request.</p></div>
                    <Button className="primary-button" onClick={() => { setFlow("connect"); openConnectorModal(); }}><HugeIcon icon={Wallet01Icon} />Connect wallet</Button>
                  </div>
                ) : (
                  <Tabs value={activeSignTab} onValueChange={(value) => setActiveSignTab(value as "sign" | "verify")}>
                    <TabsList variant="line" className="inner-tabs" aria-label="Sign and verify actions">
                      <TabsTrigger value="sign"><HugeIcon icon={Pen01Icon} />Sign</TabsTrigger>
                      <TabsTrigger value="verify"><HugeIcon icon={SecurityCheckIcon} />Verify</TabsTrigger>
                    </TabsList>
                    <TabsContent value="sign">
                      <form className="task-form" onSubmit={(event) => { event.preventDefault(); void signMessage(); }}>
                        <label htmlFor="sign-message">Message<textarea id="sign-message" value={message} onChange={(event) => { setMessage(event.target.value); setSignature(null); }} /></label>
                        <div className="form-actions"><Button className="primary-button" type="submit" disabled={isBusy}>{isBusy ? <LoadingIcon /> : <HugeIcon icon={Pen01Icon} />}{isBusy ? "Signing…" : "Sign message"}</Button></div>
                        {signature && <div className="output-block"><span className="data-label">Signature</span><code>{signature}</code></div>}
                      </form>
                    </TabsContent>
                    <TabsContent value="verify">
                      <form className="task-form" onSubmit={(event) => { event.preventDefault(); void verifyMessageSignature(); }}>
                        <label htmlFor="verify-message">Message<textarea id="verify-message" value={message} onChange={(event) => { setMessage(event.target.value); setVerificationResult(null); }} /></label>
                        <label htmlFor="verify-signature">Signature<Input id="verify-signature" value={verifySignature} onChange={(event) => { setVerifySignature(event.target.value); setVerificationResult(null); }} placeholder="Hex signature" autoComplete="off" spellCheck={false} /></label>
                        <div className="form-actions"><Button className="primary-button" type="submit" disabled={isBusy}>{isBusy ? <LoadingIcon /> : <HugeIcon icon={SecurityCheckIcon} />}{isBusy ? "Checking…" : "Verify signature"}</Button></div>
                        {verificationResult !== null && <p className={`result-line ${verificationResult ? "" : "invalid"}`} role="status"><HugeIcon icon={verificationResult ? CheckmarkCircle02Icon : SecurityCheckIcon} />{verificationResult ? "Signature is valid for the connected identity." : "Signature is not valid for the connected identity."}</p>}
                      </form>
                    </TabsContent>
                  </Tabs>
                )}
                <RequestStatus feedback={glyphFeedback} preparing={glyphRelayPreparing} />
              </section>
            )}
            {errorMessage && <p className="error-line workspace-error" role="alert">{errorMessage}</p>}
          </div>
        </main>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Connect a wallet</DialogTitle>
              <DialogDescription>Select an available connector to continue.</DialogDescription>
            </DialogHeader>
            <div className="connector-list">
              {availableConnectors.map((connector) => (
                <WalletChoice
                  key={connector.id}
                  connector={connector}
                  pendingId={pendingId}
                  glyphRelayPreparing={glyphRelayPreparing}
                  onConnect={(id) => void connect(id)}
                />
              ))}
            </div>
            {pairingUri && <div className="pairing-box"><QRCodeSVG value={pairingUri} size={168} includeMargin bgColor="transparent" fgColor="currentColor" /><p>Scan with your WalletConnect wallet.</p></div>}
            {actionError && <p className="error-line" role="alert">{actionError}</p>}
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
