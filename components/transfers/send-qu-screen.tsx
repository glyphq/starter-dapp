"use client";

import { useState, type FormEvent } from "react";
import { SendIcon, WalletIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Identicon } from "@/components/wallet/identicon";
import { useWalletSession } from "@/components/wallet/wallet-session-provider";
import { requestGlyphTransfer } from "@/lib/connectors/glyph";
import { prepareSendQus } from "@/lib/contracts/starter-procedures";

export function SendQusScreen() {
  const {
    wallet,
    pendingAction,
    runAction,
    ensureGlyphReady,
    openWalletDialog,
  } = useWalletSession();
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [working, setWorking] = useState(false);
  const connected = Boolean(wallet.account && wallet.activeConnector);
  const isGlyph = wallet.activeConnector?.id === "glyph-wallet";
  const busy = working || pendingAction !== null;
  const identity = wallet.account?.identity;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!wallet.account || !wallet.activeConnector) {
      openWalletDialog();
      return;
    }
    if (isGlyph && !ensureGlyphReady()) return;

    let transfer;
    try {
      transfer = prepareSendQus(destination, amount);
    } catch (reason) {
      toast.error(
        reason instanceof Error
          ? reason.message
          : "Check the destination and amount, then try again.",
      );
      return;
    }

    setWorking(true);
    try {
      const result = await runAction(
        transfer.label,
        () =>
          isGlyph
            ? requestGlyphTransfer(transfer.destination, transfer.amount)
            : wallet.sendTransaction({
                destination: transfer.destination,
                amount: transfer.amount,
              }),
        "The transfer was not completed. Check your wallet, then try again.",
      );
      if (result !== undefined) {
        toast.success("Transfer request approved.", {
          icon: identity ? (
            <Identicon identity={identity} size={20} />
          ) : undefined,
        });
      }
    } finally {
      setWorking(false);
    }
  }

  if (!connected) {
    return (
      <section
        className="flow-panel procedure-screen"
        aria-labelledby="send-qu-title"
      >
        <header className="flow-heading">
          <h2 id="send-qu-title">Send QUs</h2>
          <p>Connect a wallet to prepare a direct QU transfer.</p>
        </header>
        <div className="form-actions task-action-stack">
          <Button type="button" onClick={openWalletDialog} disabled={busy}>
            <WalletIcon aria-hidden="true" />
            Connect wallet
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section
      className="flow-panel procedure-screen"
      aria-labelledby="send-qu-title"
      aria-busy={busy}
    >
      <header className="flow-heading">
        <h2 id="send-qu-title">Send QUs</h2>
        <p>Send a whole-QU amount directly to a Qubic identity.</p>
      </header>
      <form
        className="task-form contract-procedure-form"
        onSubmit={(event) => void submit(event)}
      >
        <label htmlFor="send-qu-recipient">
          Qubic identity
          <input
            id="send-qu-recipient"
            value={destination}
            disabled={busy}
            placeholder="Qubic identity"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            onChange={(event) => setDestination(event.target.value)}
          />
        </label>
        <label htmlFor="send-qu-amount">
          Amount (QU)
          <input
            id="send-qu-amount"
            inputMode="numeric"
            value={amount}
            disabled={busy}
            placeholder="1000000"
            autoComplete="off"
            onChange={(event) => setAmount(event.target.value)}
          />
          <span className="field-help">
            Check the destination before approving the transfer in your wallet.
          </span>
        </label>
        <div className="form-actions task-action-stack">
          <Button type="submit" disabled={busy}>
            <SendIcon aria-hidden="true" />
            {working ? "Opening wallet…" : "Send QUs"}
          </Button>
        </div>
      </form>
    </section>
  );
}
