"use client";

import { useState } from "react";
import Image from "next/image";
import { MoonIcon, SunIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLotteryPurchase } from "@/hooks/use-lottery-purchase";
import { useTheme } from "@/hooks/use-theme";
import { useWalletSession } from "@/components/wallet/wallet-session-provider";
import { AccountMenu } from "@/components/wallet/account-menu";
import { ConnectScreen } from "@/components/wallet/connect-screen";
import { WalletDialog } from "@/components/wallet/wallet-dialog";
import { RequestStatus } from "@/components/wallet/request-status";
import { RandomLotteryScreen } from "@/components/random-lottery/random-lottery-screen";
import { SignaturesScreen } from "@/components/signatures/signatures-screen";

export const referenceFlows = [
  { id: "connect", label: "Connect" },
  { id: "random-lottery", label: "RandomLottery" },
  { id: "sign-verify", label: "Sign & Verify" },
] as const;
type Flow = (typeof referenceFlows)[number]["id"];

/** Composition only: each screen owns its own form, request inputs and results. */
export function StarterApp() {
  const {
    wallet,
    pendingAction,
    dialogOpen,
    openWalletDialog,
    dismissFeedback,
  } = useWalletSession();
  const { theme, toggleTheme } = useTheme();
  const purchaseState = useLotteryPurchase();
  const [flow, setFlow] = useState<Flow>("connect");
  const sessionKey = `${wallet.activeConnector?.id ?? "none"}:${wallet.account?.identity ?? "none"}`;
  function navigate(next: Flow) {
    if (pendingAction) return;
    dismissFeedback();
    setFlow(next);
  }
  return (
    <div className="workspace-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="workspace-header">
        <button
          className="workspace-brand"
          type="button"
          onClick={() => navigate("connect")}
          disabled={Boolean(pendingAction)}
          aria-label="Qubic wallet flows home"
        >
          <Image
            className="glyph-mark"
            src="/brand/glyph-mark.png"
            alt=""
            width={28}
            height={28}
          />
          <span>
            Qubic <strong>Wallet flows</strong>
          </span>
        </button>
        <div className="workspace-header-actions">
          <span className="network-label">
            <span className="status-dot" aria-hidden="true" />
            Mainnet
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </Button>
          {wallet.account && wallet.activeConnector ? (
            <AccountMenu key={sessionKey} />
          ) : (
            <Button variant="outline" onClick={openWalletDialog}>
              Connect wallet
            </Button>
          )}
        </div>
      </header>
      <main className="workspace-main" id="main-content" tabIndex={-1}>
        <div className="workspace-intro">
          <span className="eyebrow">Qubic developer reference</span>
          <h1>Wallet playground.</h1>
          <p>
            Connect your wallet. Try a signature. Explore a contract.
            Your keys stay with you.
          </p>
        </div>
        <nav className="flow-nav" aria-label="Reference flows">
          {referenceFlows.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={`flow-nav-item ${flow === item.id ? "active" : ""}`}
              onClick={() => navigate(item.id)}
              disabled={Boolean(pendingAction)}
              aria-current={flow === item.id ? "page" : undefined}
            >
              <span className="nav-index">0{index + 1}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="flow-stage" key={sessionKey}>
          {!dialogOpen && <RequestStatus />}
          {flow === "connect" && <ConnectScreen onNavigate={navigate} />}
          {flow === "random-lottery" && (
            <RandomLotteryScreen purchaseState={purchaseState} />
          )}
          {flow === "sign-verify" && <SignaturesScreen />}
        </div>
        <footer className="workspace-footer">
          <span>Independent software for Qubic.</span>
          <a href="https://docs.glyphq.org" target="_blank" rel="noreferrer">
            Integration docs ↗
          </a>
        </footer>
      </main>
      <WalletDialog />
    </div>
  );
}
