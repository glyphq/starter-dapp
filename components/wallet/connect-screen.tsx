"use client";

import { Button } from "@/components/ui/button";
import { connectorLabel } from "@/lib/connectors/availability";
import { useWalletSession } from "./wallet-session-provider";

type NextFlow = "random-lottery" | "sign-verify";

export function ConnectScreen({
  onNavigate,
}: {
  onNavigate: (flow: NextFlow) => void;
}) {
  const { wallet, pendingAction, openWalletDialog, disconnect } =
    useWalletSession();
  const connected = wallet.account && wallet.activeConnector;
  return (
    <section className="flow-panel" aria-labelledby="connect-title">
      <div className="flow-heading">
        <span className="eyebrow">Start here</span>
        <h2 id="connect-title">Connect</h2>
        <p>
          A small workspace for Qubic wallet interactions. Connect once, then
          choose a focused example.
        </p>
      </div>
      {connected ? (
        <div className="account-summary">
          <div className="summary-heading">
            <span className="status-dot online" aria-hidden="true" />
            <strong>
              {connectorLabel(wallet.activeConnector!.id)} connected
            </strong>
          </div>
          <span className="data-label">Your identity</span>
          <code>{wallet.account!.identity}</code>
          <p>
            Connection identifies your account. Every signing or spending
            request still needs wallet approval.
          </p>
          <Button
            variant="outline"
            onClick={disconnect}
            disabled={Boolean(pendingAction)}
          >
            Disconnect wallet
          </Button>
        </div>
      ) : (
        <div className="connect-prompt">
          <div>
            <strong>Your wallet. Your approval.</strong>
            <p>
              Use Glyph desktop, a Qubic browser extension, or WalletConnect.
              Setup requirements are shown before you connect.
            </p>
          </div>
          <Button onClick={openWalletDialog} disabled={Boolean(pendingAction)}>
            Choose wallet
          </Button>
        </div>
      )}
      <div className="example-list" aria-label="Explore the examples">
        <button
          type="button"
          onClick={() => onNavigate("sign-verify")}
          disabled={Boolean(pendingAction)}
        >
          <span className="example-index">01</span>
          <span>
            <strong>Sign & Verify</strong>
            <small>Sign a message or check a signature. No funds move.</small>
          </span>
          <span aria-hidden="true">↗</span>
        </button>
        <button
          type="button"
          onClick={() => onNavigate("random-lottery")}
          disabled={Boolean(pendingAction)}
        >
          <span className="example-index">02</span>
          <span>
            <strong>RandomLottery</strong>
            <small>
              Review a real paid contract call before wallet approval.
            </small>
          </span>
          <span aria-hidden="true">↗</span>
        </button>
      </div>
      <p className="safety-note">
        This app never asks for a seed or private key. Glyph requests are bound
        to Qubic mainnet.
      </p>
    </section>
  );
}
