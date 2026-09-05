"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useWallet } from "@qubic.org/react";
import { hasWalletConnectProjectId } from "@/lib/connectors";
import { connectorAvailability } from "@/lib/connectors/availability";
import { getGlyphAppOrigin } from "@/lib/connectors/glyph-origin";
import { isGlyphLaunchAbort } from "@/lib/connectors/glyph-launch";
import {
  GLYPH_REQUEST_STATUS_EVENT,
  isGlyphRelaySessionReady,
  prewarmGlyphRelaySession,
  type GlyphRequestFeedback,
} from "@/lib/connectors/glyph";

type WalletSession = {
  wallet: ReturnType<typeof useWallet>;
  pendingAction: string | null;
  error: string | null;
  notice: string | null;
  feedback: GlyphRequestFeedback | null;
  dialogOpen: boolean;
  pairingUri: string | null;
  relayReady: boolean;
  setDialogOpen: (open: boolean) => void;
  openWalletDialog: () => void;
  dismissFeedback: () => void;
  runAction: <T>(
    label: string,
    operation: () => Promise<T>,
    failureMessage: string,
  ) => Promise<T | undefined>;
  prepareGlyph: () => Promise<void>;
  ensureGlyphReady: () => boolean;
  connect: (id: string) => void;
  disconnect: () => void;
};

const WalletSessionContext = createContext<WalletSession | null>(null);

/** App-wide coordination only. Forms, quotes and results belong to their screens. */
export function WalletSessionProvider({ children }: { children: ReactNode }) {
  const wallet = useWallet();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<GlyphRequestFeedback | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pairingUri, setPairingUri] = useState<string | null>(null);
  const [dismissedWalletError, setDismissedWalletError] = useState<unknown>();
  const accountKey = `${wallet.activeConnector?.id ?? "none"}:${wallet.account?.identity ?? "none"}`;
  const [previousAccountKey, setPreviousAccountKey] = useState(accountKey);
  const inFlight = useRef(false);
  const [, refreshReadiness] = useState(0);

  // WalletProvider.connect reports rejection through wallet.error, not a rejected
  // promise. Only an observed account transition establishes successful connection.
  if (previousAccountKey !== accountKey) {
    setPreviousAccountKey(accountKey);
    setDialogOpen(false);
    setPairingUri(null);
    setError(null);
    setFeedback(null);
    setNotice(
      wallet.account
        ? "Wallet connected. Requests still require approval in your wallet."
        : "Wallet disconnected. Your keys remain in your wallet.",
    );
  }

  useEffect(() => {
    const onStatus = (event: Event) =>
      setFeedback((event as CustomEvent<GlyphRequestFeedback>).detail);
    const onAbort = (event: PromiseRejectionEvent) => {
      if (isGlyphLaunchAbort(event.reason)) event.preventDefault();
    };
    window.addEventListener(GLYPH_REQUEST_STATUS_EVENT, onStatus);
    window.addEventListener("unhandledrejection", onAbort, { capture: true });
    return () => {
      window.removeEventListener(GLYPH_REQUEST_STATUS_EVENT, onStatus);
      window.removeEventListener("unhandledrejection", onAbort, {
        capture: true,
      });
    };
  }, []);

  // Preparation registers a relay session only. It never opens or approves a wallet.
  useEffect(() => {
    if (
      pendingAction ||
      (!dialogOpen && wallet.activeConnector?.id !== "glyph-wallet")
    )
      return;
    const glyph = wallet.connectors.find(
      (connector) => connector.id === "glyph-wallet",
    );
    if (
      !glyph ||
      !connectorAvailability(glyph, hasWalletConnectProjectId).available
    )
      return;
    let active = true;
    void prewarmGlyphRelaySession().then(
      () => {
        if (active) refreshReadiness((value) => value + 1);
      },
      () => {
        /* A deliberate action can retry and display a safe error. */
      },
    );
    return () => {
      active = false;
    };
  }, [
    dialogOpen,
    pendingAction,
    wallet.activeConnector?.id,
    wallet.connectors,
  ]);

  function dismissFeedback() {
    setError(null);
    setNotice(null);
    setFeedback(null);
    setDismissedWalletError(wallet.error);
  }

  async function runAction<T>(
    label: string,
    operation: () => Promise<T>,
    failureMessage: string,
  ): Promise<T | undefined> {
    // A ref closes the gap before React rerenders disabled controls.
    if (inFlight.current) return undefined;
    inFlight.current = true;
    setPendingAction(label);
    dismissFeedback();
    try {
      // Invoke immediately: Glyph launch must retain the activating click.
      return await operation();
    } catch {
      setError(failureMessage);
      return undefined;
    } finally {
      inFlight.current = false;
      setPendingAction(null);
    }
  }

  async function prepareGlyph() {
    getGlyphAppOrigin();
    await prewarmGlyphRelaySession();
    setNotice(
      "Secure session ready. Click your action again to open Glyph Wallet.",
    );
  }

  function ensureGlyphReady() {
    if (inFlight.current) return false;
    if (isGlyphRelaySessionReady()) return true;
    void runAction(
      "Preparing Glyph Wallet",
      prepareGlyph,
      "Could not prepare a secure Glyph session. Check your HTTPS configuration and try again.",
    );
    return false;
  }

  function openWalletDialog() {
    if (!inFlight.current) {
      dismissFeedback();
      setPairingUri(null);
    }
    // Opening the chooser allows background preparation, never native launch.
    setDialogOpen(true);
  }

  function connect(id: string) {
    const connector = wallet.connectors.find((entry) => entry.id === id);
    if (
      !connector ||
      !connectorAvailability(connector, hasWalletConnectProjectId).available
    )
      return;
    if (id === "glyph-wallet" && !ensureGlyphReady()) return;
    void runAction(
      "Connecting wallet",
      async () => {
        await wallet.connect(id, { onUri: setPairingUri });
      },
      "Connection was not completed. Check your wallet, then try again.",
    );
  }

  function disconnect() {
    void runAction(
      "Disconnecting wallet",
      async () => {
        await wallet.disconnect();
        setPairingUri(null);
        setNotice("Wallet disconnected. Your keys remain in your wallet.");
      },
      "Could not disconnect. Try again.",
    );
  }

  return (
    <WalletSessionContext.Provider
      value={{
        wallet,
        pendingAction,
        error:
          error ??
          (wallet.error && wallet.error !== dismissedWalletError
            ? "Connection was not completed. Check your wallet, then try again."
            : null),
        notice,
        feedback,
        dialogOpen,
        pairingUri,
        relayReady: isGlyphRelaySessionReady(),
        setDialogOpen,
        openWalletDialog,
        dismissFeedback,
        runAction,
        prepareGlyph,
        ensureGlyphReady,
        connect,
        disconnect,
      }}
    >
      {children}
    </WalletSessionContext.Provider>
  );
}

export function useWalletSession() {
  const session = useContext(WalletSessionContext);
  if (!session)
    throw new Error(
      "useWalletSession must be used inside WalletSessionProvider",
    );
  return session;
}
