"use client";

import { useState } from "react";
import { ExternalLinkIcon, ShieldCheckIcon, WalletIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWalletSession } from "@/components/wallet/wallet-session-provider";
import {
  isGlyphRelaySessionReady,
  requestGlyphScCall,
  type GlyphScCallInput,
} from "@/lib/connectors/glyph";
import {
  CONTRACT_CALL_DEFINITIONS,
  qubicExplorerTransactionUrl,
} from "@/lib/contracts/contract-call";

const defaultCall = CONTRACT_CALL_DEFINITIONS[0];

export function ContractCallScreen() {
  const { wallet, pendingAction, runAction, prepareGlyph, openWalletDialog } =
    useWalletSession();
  const [reviewedCall, setReviewedCall] = useState<GlyphScCallInput | null>(
    null,
  );
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeConnector = wallet.activeConnector?.id;
  const canApprove =
    activeConnector === "glyph-wallet" && Boolean(wallet.account);
  const busy = pendingAction !== null;

  function reviewCall() {
    if (!canApprove) {
      openWalletDialog();
      return;
    }
    setError(null);
    setTransactionId(null);
    void runAction(
      "Preparing contract call",
      async () => {
        await prepareGlyph();
        setReviewedCall(defaultCall.request);
      },
      "Could not prepare this contract call. Check your connection and try again.",
    );
  }

  function openWallet() {
    if (!reviewedCall || !canApprove) return;
    if (!isGlyphRelaySessionReady()) {
      setReviewedCall(null);
      setError("Review the call again after the secure session is ready.");
      return;
    }
    setError(null);
    void runAction(
      "Waiting for contract approval",
      async () => {
        const result = await requestGlyphScCall(reviewedCall);
        setReviewedCall(null);
        setTransactionId(result.txId);
      },
      "The contract call was not completed. Check your wallet and try again.",
    );
  }

  return (
    <section
      className="flow-panel contract-call-screen"
      aria-labelledby="contract-call-title"
    >
      <header className="flow-heading">
        <h2 id="contract-call-title">Contract call</h2>
        <p>Review a code-defined request, then approve it in your wallet.</p>
      </header>

      <div
        className="contract-call-summary"
        aria-label="Contract call template"
      >
        <div>
          <span className="data-label">Template</span>
          <strong>{defaultCall.label}</strong>
        </div>
        <div>
          <span className="data-label">Contract</span>
          <code>{defaultCall.request.contractIndex}</code>
        </div>
        <div>
          <span className="data-label">Input type</span>
          <code>{defaultCall.request.inputType}</code>
        </div>
        <div>
          <span className="data-label">Amount</span>
          <code>{defaultCall.request.amount ?? "0"} QU</code>
        </div>
      </div>
      <p className="help-text">{defaultCall.description}</p>

      {activeConnector && !canApprove && (
        <p className="notice" role="status">
          This reference call uses Glyph Wallet. Choose Glyph to approve it.
        </p>
      )}
      <div className="form-actions task-action-stack">
        <Button onClick={reviewCall} disabled={busy}>
          {canApprove ? (
            <ShieldCheckIcon aria-hidden="true" />
          ) : (
            <WalletIcon aria-hidden="true" />
          )}
          {busy
            ? "Preparing…"
            : canApprove
              ? "Review call"
              : activeConnector
                ? "Choose Glyph Wallet"
                : "Connect wallet"}
        </Button>
      </div>

      {reviewedCall && (
        <div className="contract-call-review" role="status" aria-live="polite">
          <span className="data-label">Ready for approval</span>
          <strong>
            Contract {reviewedCall.contractIndex} · input{" "}
            {reviewedCall.inputType}
          </strong>
          <p>
            {reviewedCall.amount ?? "0"} QU ·{" "}
            {reviewedCall.payload ? "ABI payload included" : "No payload"}
          </p>
          <div className="task-action-stack">
            <Button onClick={openWallet} disabled={busy}>
              <ExternalLinkIcon aria-hidden="true" /> Open Glyph Wallet
            </Button>
          </div>
        </div>
      )}

      {transactionId && (
        <p className="result-line" role="status">
          Contract call signed.{" "}
          <a
            href={qubicExplorerTransactionUrl(transactionId)}
            target="_blank"
            rel="noreferrer"
          >
            View transaction in Explorer
          </a>
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
