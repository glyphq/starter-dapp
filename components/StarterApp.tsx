"use client";

import { useBalance, useWallet } from "@qubic.org/react";
import { identityToPublicKey, isValidIdentityChecksum, k12, verify } from "@qubic.org/crypto";
import Image from "next/image";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  CancelCircleIcon,
  CheckmarkCircle02Icon,
  Copy01Icon,
  DashboardSquare01Icon,
  Logout01Icon,
  Menu01Icon,
  MoneySend01Icon,
  Moon02Icon,
  Pen01Icon,
  SecurityCheckIcon,
  Shield01Icon,
  Sun02Icon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons";
import { QRCodeSVG } from "qrcode.react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { hasWalletConnectProjectId } from "@/lib/connectors";
import {
  GLYPH_REQUEST_STATUS_EVENT,
  buildGlyphSafeDiagnostic,
  createGlyphRequestIntentHandlers,
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

type Theme = "dark" | "light";
export type StarterAction = "transfer" | "sign" | "verify";
export type StarterSection = "overview" | "wallet" | "transfer" | "sign-verify";

type Icon = IconSvgElement;
export const starterActionRegistry = [
  { id: "overview", label: "Overview", description: "Active account and quick actions.", icon: DashboardSquare01Icon },
  { id: "wallet", label: "Wallet", description: "Wallet choices and account state.", icon: Wallet01Icon },
  { id: "transfer", label: "Transfer", description: "Send QUBIC to an identity.", icon: MoneySend01Icon },
  { id: "sign-verify", label: "Sign & Verify", description: "Sign messages and check signatures.", icon: SecurityCheckIcon },
] as const satisfies ReadonlyArray<{ id: StarterSection; label: string; description: string; icon: Icon }>;

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
  return `${identity.slice(0, 10)}…${identity.slice(-10)}`;
}

const localErrors = new Set([
  "Enter a complete hexadecimal signature.",
  "Enter a valid Qubic destination identity.",
  "Enter a positive whole-number amount.",
]);

function safeErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && localErrors.has(error.message) ? error.message : fallback;
}

function hexToBytes(value: string) {
  const normalized = value.trim();
  if (!/^[0-9a-fA-F]+$/.test(normalized) || normalized.length % 2 !== 0) {
    throw new Error("Enter a complete hexadecimal signature.");
  }
  return Uint8Array.from(normalized.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16));
}

function LoadingIcon() {
  return <span className="spinner" aria-hidden="true" />;
}

function glyphRequestDescription(feedback: GlyphRequestFeedback) {
  switch (feedback.state) {
    case "opening": return "Opening wallet.";
    case "awaiting_approval": return "Approve in your wallet.";
    case "recovering": return feedback.pollAttempt && feedback.pollMaxAttempts ? `Recovering result · ${feedback.pollAttempt}/${feedback.pollMaxAttempts}` : "Recovering result.";
    case "verifying": return "Checking wallet response.";
    case "completed": return "Wallet response verified.";
    case "interrupted": return "Request interrupted. Try again.";
    case "failed": return "Request failed. Try again.";
    case "preparing": return "Preparing secure wallet session.";
  }
}

function PanelHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="panel-heading">
      <div>
        <p className="panel-eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p className="panel-description">{description}</p>
      </div>
    </div>
  );
}

export function GlyphRequestLifecycle({
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
  const description = preparing
    ? "Preparing secure wallet session."
    : feedback ? glyphRequestDescription(feedback) : "";
  return (
    <div className="request-status-slot">
      {(feedback || preparing) && (
        <div className={`request-status request-status-${state}`} role="status" aria-live="polite">
          <span className="request-status-icon">
            {state === "completed" ? <HugeIcon icon={CheckmarkCircle02Icon} /> : state === "failed" || state === "interrupted" ? <HugeIcon icon={CancelCircleIcon} /> : <LoadingIcon />}
          </span>
          <span className="request-status-copy">
            <strong>{glyphRequestMilestoneLabel(state)}</strong>
            <span>{description}</span>
            {!preparing && feedback?.supportId && <small>Support ID <code>{feedback.supportId}</code></small>}
          </span>
          {retryable && feedback && (
            <span className="request-status-actions">
              <Button variant="ghost" size="sm" type="button" onClick={onRetry} disabled={preparing}>Retry</Button>
              <Button variant="ghost" size="sm" type="button" onClick={onCopyDiagnostic}>{diagnosticCopied ? "Copied" : "Diagnostic"}</Button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function StarterActionTabs({ activeAction, onChange }: { activeAction: StarterAction; onChange: (action: StarterAction) => void }) {
  return (
    <Tabs value={activeAction} onValueChange={(value) => onChange(value as StarterAction)}>
      <TabsList variant="line" aria-label="Wallet actions">
        <TabsTrigger value="transfer"><HugeIcon icon={MoneySend01Icon} />Transfer</TabsTrigger>
        <TabsTrigger value="sign"><HugeIcon icon={Pen01Icon} />Sign</TabsTrigger>
        <TabsTrigger value="verify"><HugeIcon icon={Shield01Icon} />Verify</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

function AccountMenu({ identity, copied, onCopy, onDisconnect, disabled }: { identity: string; copied: boolean; onCopy: () => void; onDisconnect: () => void; disabled: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="account-trigger" aria-label="Open account menu" />}>
        <code title={identity}>{shortIdentity(identity)}</code>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onCopy}><HugeIcon icon={copied ? CheckmarkCircle02Icon : Copy01Icon} />{copied ? "Copied" : "Copy identity"}</DropdownMenuItem>
        <DropdownMenuItem onClick={onDisconnect} disabled={disabled}><HugeIcon icon={Logout01Icon} />Disconnect</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ConnectorMark({ connectorId }: { connectorId: string }) {
  if (connectorId === "glyph-wallet") {
    return <Image className="connector-logo glyph-logo" src="/brand/glyph-mark.png" alt="" width={22} height={22} unoptimized />;
  }
  return <HugeIcon icon={Wallet01Icon} />;
}

function WalletBalance({ identity }: { identity: string }) {
  const balance = useBalance(identity, { staleTime: 30_000, retry: 1 });
  return (
    <div className="balance-row" aria-live="polite">
      <div>
        <span className="data-label">QU balance</span>
        {balance.isLoading ? <Skeleton className="balance-skeleton" /> : balance.isError ? <strong className="balance-unavailable">Unavailable</strong> : <strong className="balance-value">{balance.data ? `${balance.data.balance.toLocaleString()} QU` : "Unavailable"}</strong>}
      </div>
      {balance.data ? <small>Tick {balance.data.validForTick.toLocaleString()}</small> : balance.isError ? <Button variant="ghost" size="sm" type="button" onClick={() => void balance.refetch()}>Retry</Button> : null}
    </div>
  );
}

function ShellToggle() {
  const { toggleSidebar } = useSidebar();
  return (
    <Tooltip>
      <TooltipTrigger render={<Button variant="ghost" size="icon" className="shell-toggle" type="button" onClick={toggleSidebar} aria-label="Toggle navigation" />}>
        <HugeIcon icon={Menu01Icon} />
      </TooltipTrigger>
      <TooltipContent>Toggle navigation</TooltipContent>
    </Tooltip>
  );
}

export function StarterApp() {
  const wallet = useWallet();
  const [section, setSection] = useState<StarterSection>("overview");
  const theme = useSyncExternalStore<Theme>(subscribeToTheme, readStoredTheme, () => "dark");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pairingUri, setPairingUri] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [glyphFeedback, setGlyphFeedback] = useState<GlyphRequestFeedback | null>(null);
  const [glyphRelayPreparing, setGlyphRelayPreparing] = useState(false);
  const [glyphDiagnosticCopied, setGlyphDiagnosticCopied] = useState(false);
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  const [activeSignTab, setActiveSignTab] = useState<"sign" | "verify">("sign");
  const [message, setMessage] = useState("Hello from Qubic.");
  const [verifySignature, setVerifySignature] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<boolean | null>(null);
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [transferResult, setTransferResult] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [copiedIdentity, setCopiedIdentity] = useState(false);
  const freshRetrySessionReady = useRef(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const onStatus = (event: Event) => setGlyphFeedback((event as CustomEvent<GlyphRequestFeedback>).detail);
    window.addEventListener(GLYPH_REQUEST_STATUS_EVENT, onStatus);
    return () => window.removeEventListener(GLYPH_REQUEST_STATUS_EVENT, onStatus);
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
    document.documentElement.dataset.theme = next;
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  };

  const prepareGlyphRelayForIntent = useCallback((fresh = false, onReady?: () => void) => {
    if (glyphRelayPreparing) return;
    setGlyphRelayPreparing(true);
    setActionError(null);
    void (fresh ? prepareFreshGlyphRelaySession() : prewarmGlyphRelaySession())
      .then(() => {
        setGlyphRelayPreparing(false);
        onReady?.();
      })
      .catch(() => {
        setGlyphRelayPreparing(false);
        setActionError("Wallet session preparation failed. Try again.");
      });
  }, [glyphRelayPreparing]);

  const glyphIntentHandlers = useMemo(() => {
    const handlers = createGlyphRequestIntentHandlers(() => prepareGlyphRelayForIntent());
    return { onPointerEnter: () => handlers.onPointerEnter(), onFocus: () => handlers.onFocus(), onTouchStart: () => handlers.onTouchStart(), onClick: () => handlers.onClick() };
  }, [prepareGlyphRelayForIntent]);

  function openConnectorModal() {
    setActionError(null);
    setPairingUri(null);
    setDialogOpen(true);
  }

  async function connect(connectorId: string, freshRetry = false) {
    if (connectorId === "glyph-wallet" && (freshRetry || !isGlyphRelaySessionReady())) {
      prepareGlyphRelayForIntent(freshRetry, () => void connect(connectorId));
      return;
    }
    setPendingId(connectorId);
    setPairingUri(null);
    setActionError(null);
    try {
      await wallet.connect(connectorId, { onUri: setPairingUri });
      setDialogOpen(false);
      toast.success("Wallet ready");
    } catch {
      setActionError("The wallet could not be selected. Try again.");
      toast.error("Wallet selection failed", { description: "Try the wallet request again." });
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
      setTransferResult(null);
      setVerificationResult(null);
      toast.success("Wallet disconnected");
    } catch {
      setActionError("The wallet could not disconnect. Try again.");
      toast.error("Disconnect failed", { description: "Try again." });
    } finally {
      setPendingId(null);
    }
  }

  async function signMessage(freshRetry = false) {
    if (wallet.activeConnector?.id === "glyph-wallet" && (freshRetry || !isGlyphRelaySessionReady())) {
      prepareGlyphRelayForIntent(freshRetry);
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

  async function sendTransfer(freshRetry = false) {
    if (!wallet.activeConnector) return;
    if (wallet.activeConnector.id === "glyph-wallet" && (freshRetry || !isGlyphRelaySessionReady())) {
      prepareGlyphRelayForIntent(freshRetry);
      return;
    }
    setIsBusy(true);
    setActionError(null);
    setTransferResult(null);
    try {
      if (!isValidIdentityChecksum(destination.trim())) throw new Error("Enter a valid Qubic destination identity.");
      if (!/^\d+$/.test(amount.trim()) || BigInt(amount.trim()) <= BigInt(0)) throw new Error("Enter a positive whole-number amount.");
      const result = wallet.activeConnector.id === "glyph-wallet"
        ? await requestGlyphTransfer(destination.trim(), amount.trim())
        : await wallet.sendTransaction({ destination: destination.trim(), amount: amount.trim() });
      setTransferResult(result.txId);
      toast.success("Transfer submitted");
    } catch (error) {
      setActionError(safeErrorMessage(error, "The transfer could not be completed. Check the inputs."));
      toast.error("Transfer failed", { description: "Check the inputs and try again." });
    } finally {
      setIsBusy(false);
    }
  }

  async function verifyMessageSignature(freshRetry = false) {
    if (!wallet.account || !wallet.activeConnector) return;
    if (wallet.activeConnector.id === "glyph-wallet" && (freshRetry || !isGlyphRelaySessionReady())) {
      prepareGlyphRelayForIntent(freshRetry);
      return;
    }
    setIsBusy(true);
    setActionError(null);
    setVerificationResult(null);
    try {
      if (wallet.activeConnector.id === "glyph-wallet") {
        setVerificationResult(await requestGlyphVerification(message, verifySignature));
      } else {
        const publicKey = identityToPublicKey(wallet.account.identity);
        setVerificationResult(verify(k12(new TextEncoder().encode(message), 32), hexToBytes(verifySignature), publicKey));
      }
      toast.success("Signature checked");
    } catch (error) {
      setActionError(safeErrorMessage(error, "The signature could not be verified. Check the inputs."));
      toast.error("Verification failed", { description: "Check the inputs and try again." });
    } finally {
      setIsBusy(false);
    }
  }

  async function copyOutput(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedValue(value);
      window.setTimeout(() => setCopiedValue(null), 1800);
      toast.success("Copied");
    } catch {
      setActionError("Could not copy the output. Try again.");
      toast.error("Copy failed", { description: "Try again." });
    }
  }

  async function copyIdentity() {
    if (!wallet.account) return;
    await copyOutput(wallet.account.identity);
    setCopiedIdentity(true);
    window.setTimeout(() => setCopiedIdentity(false), 1800);
  }

  function retryGlyphRequest() {
    const requestType = glyphFeedback?.requestType;
    if (!glyphFeedback || !isGlyphRequestRetryable(glyphFeedback.state)) return;
    if (!freshRetrySessionReady.current) {
      prepareGlyphRelayForIntent(true, () => { freshRetrySessionReady.current = true; });
      return;
    }
    freshRetrySessionReady.current = false;
    if (requestType === "connect") void connect("glyph-wallet");
    if (requestType === "transfer") void sendTransfer();
    if (requestType === "sign_message") void signMessage();
    if (requestType === "verify_message") void verifyMessageSignature();
  }

  async function copyGlyphDiagnostic() {
    if (!glyphFeedback) return;
    try {
      await navigator.clipboard.writeText(buildGlyphSafeDiagnostic(glyphFeedback));
      setGlyphDiagnosticCopied(true);
      window.setTimeout(() => setGlyphDiagnosticCopied(false), 1800);
      toast.success("Diagnostic copied");
    } catch {
      setActionError("Could not copy the diagnostic. Try again.");
    }
  }

  const activeRegistryItem = starterActionRegistry.find((item) => item.id === section) ?? starterActionRegistry[0];
  const errorMessage = actionError || (wallet.error ? "The wallet request could not be completed. Try again." : null);
  const connected = Boolean(wallet.account && wallet.activeConnector);
  const availableConnectors = wallet.connectors.filter((connector) => connectorAvailable(connector) && !(connector.id === "walletconnect" && !hasWalletConnectProjectId));

  return (
    <TooltipProvider>
      <Toaster theme={theme as "dark" | "light"} />
      <SidebarProvider>
        <Sidebar collapsible="icon">
          <SidebarHeader>
            <div className="sidebar-brand">
              <Image className="glyph-logo" src="/brand/glyph-mark.png" alt="Glyph" width={22} height={22} priority unoptimized />
              <div className="sidebar-brand-copy"><strong>Qubic Starter</strong><span>Reference app</span></div>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Workspace</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {starterActionRegistry.map((item) => (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton isActive={item.id === section} tooltip={item.label} onClick={() => setSection(item.id)}>
                        <HugeIcon icon={item.icon} /><span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <div className="sidebar-connection"> <span className={connected ? "status-dot online" : "status-dot"} /> <span>{connected ? "Active" : "No wallet"}</span></div>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
          <div className="starter-shell">
            <header className="workspace-header">
              <div className="workspace-header-left"><ShellToggle /><div><h1>{activeRegistryItem.label}</h1></div></div>
              <div className="workspace-tools">
                <Tooltip>
                  <TooltipTrigger render={<Button variant="outline" size="icon" type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} />}>
                    <HugeIcon icon={theme === "dark" ? Sun02Icon : Moon02Icon} />
                  </TooltipTrigger>
                  <TooltipContent>{`Switch to ${theme === "dark" ? "light" : "dark"} theme`}</TooltipContent>
                </Tooltip>
                {wallet.account ? <AccountMenu identity={wallet.account.identity} copied={copiedIdentity} onCopy={() => void copyIdentity()} onDisconnect={() => void disconnect()} disabled={Boolean(pendingId)} /> : <Button variant="outline" size="sm" onClick={() => { setSection("wallet"); openConnectorModal(); prepareGlyphRelayForIntent(); }}><HugeIcon icon={Wallet01Icon} />Choose wallet</Button>}
              </div>
            </header>

            <main className="workspace-main">
              {section === "overview" && (
                <section className="route-panel overview-panel" aria-labelledby="overview-title">
                  <PanelHeading eyebrow="Account" title="Overview" description="Your active wallet at a glance." />
                  <Separator className="panel-separator" />
                  {wallet.account ? (
                    <>
                      <div className="account-context"><div><span className="data-label">Identity</span><code>{wallet.account.identity}</code></div><div><span className="data-label">Wallet</span><span>{wallet.activeConnector?.id === "glyph-wallet" ? "Glyph Wallet" : wallet.activeConnector?.id ?? "Wallet"}</span></div></div>
                      <WalletBalance identity={wallet.account.identity} />
                      <div className="quick-actions"><span className="data-label">Quick actions</span><div className="quick-action-row"><Button variant="outline" onClick={() => setSection("transfer")}><HugeIcon icon={MoneySend01Icon} />Transfer</Button><Button variant="outline" onClick={() => { setActiveSignTab("sign"); setSection("sign-verify"); }}><HugeIcon icon={Pen01Icon} />Sign</Button><Button variant="outline" onClick={() => { setActiveSignTab("verify"); setSection("sign-verify"); }}><HugeIcon icon={Shield01Icon} />Verify</Button></div></div>
                    </>
                  ) : (
                    <div className="empty-state"><HugeIcon icon={Wallet01Icon} /><div><strong>No wallet selected</strong><span>Choose a wallet to use the workspace.</span></div><Button className="primary-button" onClick={() => { setSection("wallet"); openConnectorModal(); prepareGlyphRelayForIntent(); }}><HugeIcon icon={Wallet01Icon} />Choose wallet</Button></div>
                  )}
                </section>
              )}

              {section === "wallet" && (
                <section className="route-panel" aria-labelledby="wallet-title">
                  <PanelHeading eyebrow="Account" title="Wallet" description="Manage the active wallet and account." />
                  <Separator className="panel-separator" />
                  {wallet.account ? (
                    <div className="wallet-state"><div className="account-context"><div><span className="data-label">Identity</span><code>{wallet.account.identity}</code></div><div><span className="data-label">Wallet</span><span>{wallet.activeConnector?.id === "glyph-wallet" ? "Glyph Wallet" : wallet.activeConnector?.id ?? "Wallet"}</span></div></div><Button variant="outline" onClick={() => void disconnect()} disabled={Boolean(pendingId)}><HugeIcon icon={Logout01Icon} />Disconnect</Button></div>
                  ) : (
                    <div className="empty-state"><HugeIcon icon={Wallet01Icon} /><div><strong>Choose a wallet</strong><span>Only available wallets are shown.</span></div><Button className="primary-button" onClick={() => { openConnectorModal(); prepareGlyphRelayForIntent(); }}><HugeIcon icon={Wallet01Icon} />Choose wallet</Button></div>
                  )}
                  <GlyphRequestLifecycle feedback={glyphFeedback} preparing={glyphRelayPreparing} onRetry={retryGlyphRequest} onCopyDiagnostic={() => void copyGlyphDiagnostic()} diagnosticCopied={glyphDiagnosticCopied} />
                </section>
              )}

              {section === "transfer" && (
                <section className="route-panel" aria-labelledby="transfer-title">
                  <PanelHeading eyebrow="Wallet request" title="Transfer" description="Send QUBIC to a validated identity." />
                  <Separator className="panel-separator" />
                  {!wallet.account ? <div className="empty-state"><HugeIcon icon={Wallet01Icon} /><div><strong>Wallet required</strong><span>The transfer request needs an active account.</span></div><Button className="primary-button" onClick={() => { setSection("wallet"); openConnectorModal(); prepareGlyphRelayForIntent(); }}><HugeIcon icon={Wallet01Icon} />Choose wallet</Button></div> : <form className="task-form" {...(wallet.activeConnector?.id === "glyph-wallet" ? glyphIntentHandlers : {})} onSubmit={(event) => { event.preventDefault(); void sendTransfer(); }}><div className="form-grid"><label>Destination<Input aria-label="Destination identity" value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="Qubic identity" autoComplete="off" spellCheck={false} /></label><label>Amount<Input aria-label="Amount in QUBIC" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Whole-number amount" /></label></div><div className="form-actions"><Button className="primary-button" type="submit" disabled={isBusy || !destination.trim() || !amount.trim()}>{isBusy ? <LoadingIcon /> : <HugeIcon icon={MoneySend01Icon} />}{isBusy ? "Waiting for approval" : "Request transfer"}</Button></div>{transferResult && <div className="result-line"><HugeIcon icon={CheckmarkCircle02Icon} /><span>Submitted</span><OutputValue value={transferResult} copied={copiedValue === transferResult} onCopy={() => void copyOutput(transferResult)} /></div>}</form>}
                  <GlyphRequestLifecycle feedback={glyphFeedback} preparing={glyphRelayPreparing} onRetry={retryGlyphRequest} onCopyDiagnostic={() => void copyGlyphDiagnostic()} diagnosticCopied={glyphDiagnosticCopied} />
                </section>
              )}

              {section === "sign-verify" && (
                <section className="route-panel" aria-labelledby="sign-verify-title">
                  <PanelHeading eyebrow="Wallet request" title="Sign & Verify" description="Sign a message or verify a signature against the active wallet." />
                  <Separator className="panel-separator" />
                  {!wallet.account ? <div className="empty-state"><HugeIcon icon={Wallet01Icon} /><div><strong>Wallet required</strong><span>Signing and verification use the active account.</span></div><Button className="primary-button" onClick={() => { setSection("wallet"); openConnectorModal(); prepareGlyphRelayForIntent(); }}><HugeIcon icon={Wallet01Icon} />Choose wallet</Button></div> : <Tabs value={activeSignTab} onValueChange={(value) => setActiveSignTab(value as "sign" | "verify")}><TabsList variant="line" className="inner-tabs"><TabsTrigger value="sign"><HugeIcon icon={Pen01Icon} />Sign</TabsTrigger><TabsTrigger value="verify"><HugeIcon icon={Shield01Icon} />Verify</TabsTrigger></TabsList><TabsContent value="sign"><form className="task-form" {...(wallet.activeConnector?.id === "glyph-wallet" ? glyphIntentHandlers : {})} onSubmit={(event) => { event.preventDefault(); void signMessage(); }}><div className="task-heading"><div><h3>Sign a message</h3><p>Ask the wallet to sign the text below.</p></div></div><label>Message<Textarea aria-label="Message to sign" value={message} onChange={(event) => setMessage(event.target.value)} rows={4} /></label><Button className="primary-button" type="submit" disabled={isBusy || !message.trim()}>{isBusy ? <LoadingIcon /> : <HugeIcon icon={Pen01Icon} />}{isBusy ? "Waiting for approval" : "Sign message"}</Button>{signature && <div className="result-line"><HugeIcon icon={CheckmarkCircle02Icon} /><span>Signature</span><OutputValue value={signature} copied={copiedValue === signature} onCopy={() => void copyOutput(signature)} /></div>}</form></TabsContent><TabsContent value="verify"><form className="task-form" {...(wallet.activeConnector?.id === "glyph-wallet" ? glyphIntentHandlers : {})} onSubmit={(event) => { event.preventDefault(); void verifyMessageSignature(); }}><div className="task-heading"><div><h3>Verify a signature</h3><p>Check a signature against this account.</p></div></div><label>Message<Textarea aria-label="Message to verify" value={message} onChange={(event) => setMessage(event.target.value)} rows={3} /></label><label>Signature<Textarea aria-label="Signature to verify" value={verifySignature} onChange={(event) => setVerifySignature(event.target.value)} placeholder="Hexadecimal signature" rows={3} spellCheck={false} /></label><Button className="primary-button" type="submit" disabled={isBusy || !message.trim() || !verifySignature.trim()}>{isBusy ? <LoadingIcon /> : <HugeIcon icon={Shield01Icon} />}{isBusy ? "Checking" : "Verify signature"}</Button>{verificationResult !== null && <div className={`result-line ${verificationResult ? "valid" : "invalid"}`}><HugeIcon icon={CheckmarkCircle02Icon} /><span>{verificationResult ? "Signature is valid" : "Signature is not valid"}</span></div>}</form></TabsContent></Tabs>}
                  <GlyphRequestLifecycle feedback={glyphFeedback} preparing={glyphRelayPreparing} onRetry={retryGlyphRequest} onCopyDiagnostic={() => void copyGlyphDiagnostic()} diagnosticCopied={glyphDiagnosticCopied} />
                </section>
              )}

              {errorMessage && !(glyphFeedback && isGlyphRequestRetryable(glyphFeedback.state)) && <p className="error-line" role="alert">{errorMessage}</p>}
            </main>
          </div>
        </SidebarInset>

        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!pendingId) setDialogOpen(open); }}>
          <DialogContent className="connector-dialog-content" showCloseButton={!pendingId}>
            <DialogHeader><DialogTitle>{pairingUri ? "WalletConnect" : "Choose a wallet"}</DialogTitle><DialogDescription>{pairingUri ? "Scan the code in your wallet app." : "Available wallets"}</DialogDescription></DialogHeader>
            {pairingUri ? (
              <div className="pairing-view" role="status">
                <div className="qr-frame"><QRCodeSVG value={pairingUri} size={148} /></div>
                <div className="pairing-copy"><strong>Scan to pair</strong><span>Approve in your wallet.</span><Button variant="ghost" size="sm" type="button" onClick={() => { setPairingUri(null); setPendingId(null); setDialogOpen(false); }}>Cancel</Button></div>
              </div>
            ) : (
              <>
                {wallet.account && wallet.activeConnector && <div className="dialog-active-state"><span className="connector-icon"><ConnectorMark connectorId={wallet.activeConnector.id} /></span><span><strong>Active</strong><code>{shortIdentity(wallet.account.identity)}</code></span><Button variant="ghost" size="sm" type="button" onClick={() => void disconnect()} disabled={Boolean(pendingId)}>Disconnect</Button></div>}
                <div className="connector-list">
                  {availableConnectors.length > 0 ? availableConnectors.map((connector) => {
                    const label = connector.id === "glyph-wallet" ? "Glyph Wallet" : connector.id === "qubic-extension" ? "Qubic extension" : connector.id === "walletconnect" ? "WalletConnect" : "Wallet";
                    const active = wallet.activeConnector?.id === connector.id;
                    return <Button variant="ghost" className="connector-option" data-active={active ? "true" : undefined} disabled={Boolean(pendingId) || active} key={connector.id} {...(connector.id === "glyph-wallet" ? glyphIntentHandlers : {})} onClick={() => void connect(connector.id)} type="button"><span className="connector-icon"><ConnectorMark connectorId={connector.id} /></span><span className="connector-copy"><strong>{label}</strong>{active && <small>Active</small>}</span><span className="option-state">{pendingId === connector.id ? <LoadingIcon /> : active ? <HugeIcon icon={CheckmarkCircle02Icon} /> : <HugeIcon icon={Wallet01Icon} />}</span></Button>;
                  }) : <div className="dialog-empty">No wallet is available in this environment.</div>}
                </div>
              </>
            )}
            {pendingId === "glyph-wallet" && <GlyphRequestLifecycle feedback={glyphFeedback} preparing={glyphRelayPreparing} onRetry={retryGlyphRequest} onCopyDiagnostic={() => void copyGlyphDiagnostic()} diagnosticCopied={glyphDiagnosticCopied} />}
            {actionError && <p className="dialog-error" role="alert">{actionError}</p>}
          </DialogContent>
        </Dialog>
      </SidebarProvider>
    </TooltipProvider>
  );
}

function OutputValue({ value, copied, onCopy }: { value: string; copied: boolean; onCopy: () => void }) {
  return <span className="output-value"><code title={value}>{value}</code><Tooltip><TooltipTrigger render={<Button variant="ghost" size="icon" className="copy-button" type="button" onClick={onCopy} aria-label={copied ? "Copied" : "Copy output"} />}><HugeIcon icon={copied ? CheckmarkCircle02Icon : Copy01Icon} /></TooltipTrigger><TooltipContent>{copied ? "Copied" : "Copy output"}</TooltipContent></Tooltip></span>;
}
