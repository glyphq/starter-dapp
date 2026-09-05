"use client";

import { useState } from "react";
import Image from "next/image";
import { MoonIcon, SunIcon, WalletIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLotteryPurchase } from "@/hooks/use-lottery-purchase";
import { useTheme } from "@/hooks/use-theme";
import { useWalletSession } from "@/components/wallet/wallet-session-provider";
import { AccountDialog } from "@/components/wallet/account-dialog";
import { WalletDialog } from "@/components/wallet/wallet-dialog";
import { RequestStatus } from "@/components/wallet/request-status";
import { RandomLotteryScreen } from "@/components/random-lottery/random-lottery-screen";
import { SignaturesScreen } from "@/components/signatures/signatures-screen";

export const referenceFlows = [
  { id: "sign-verify", label: "Sign & Verify" },
  { id: "random-lottery", label: "RandomLottery" },
] as const;
type Flow = (typeof referenceFlows)[number]["id"];

/** Composition only: each screen owns its own form, request inputs and results. */
export function StarterApp() {
  const { wallet, pendingAction, openWalletDialog, dismissFeedback } =
    useWalletSession();
  const { theme, toggleTheme } = useTheme();
  const purchaseState = useLotteryPurchase();
  const [flow, setFlow] = useState<Flow>("sign-verify");
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
          onClick={() => navigate("sign-verify")}
          disabled={Boolean(pendingAction)}
          aria-label="Glyph Starter home"
        >
          <Image
            className="glyph-mark"
            src="/brand/glyph-mark.png"
            alt=""
            width={28}
            height={28}
          />
          <span>
            <strong>Glyph Starter</strong>
          </span>
        </button>
        <div className="workspace-header-actions">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </Button>
          {wallet.account && wallet.activeConnector ? (
            <AccountDialog key={sessionKey} />
          ) : (
            <Button variant="outline" onClick={openWalletDialog}>
              <WalletIcon aria-hidden="true" />
              Connect wallet
            </Button>
          )}
        </div>
      </header>
      <main className="workspace-main" id="main-content" tabIndex={-1}>
        <h1 className="sr-only">Glyph Starter</h1>
        <nav className="flow-nav" aria-label="Reference flows">
          {referenceFlows.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`flow-nav-item ${flow === item.id ? "active" : ""}`}
              onClick={() => navigate(item.id)}
              disabled={Boolean(pendingAction)}
              aria-current={flow === item.id ? "page" : undefined}
            >
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="flow-stage">
          <RequestStatus />
          {flow === "random-lottery" && (
            <RandomLotteryScreen
              key={sessionKey}
              purchaseState={purchaseState}
            />
          )}
          {flow === "sign-verify" && <SignaturesScreen />}
        </div>
        <footer className="workspace-footer">
          <span className="footer-signature">
            <span className="footer-mark" aria-hidden="true" /> Built on Qubic
          </span>
          <a href="https://docs.glyphq.org" target="_blank" rel="noreferrer">
            Docs ↗
          </a>
        </footer>
      </main>
      <WalletDialog />
    </div>
  );
}
