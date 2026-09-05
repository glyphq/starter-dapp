"use client";

import { useState, type FormEvent } from "react";
import { LockKeyholeIcon, WalletIcon } from "lucide-react";
import { toast } from "sonner";
import { contractIndexToIdentity } from "@qubic.org/crypto";
import { Button } from "@/components/ui/button";
import { Identicon } from "@/components/wallet/identicon";
import { useWalletSession } from "@/components/wallet/wallet-session-provider";
import { requestGlyphScCall } from "@/lib/connectors/glyph";
import {
  prepareLockQus,
  payloadToBase64,
} from "@/lib/contracts/starter-procedures";

export function LockQusScreen() {
  const {
    wallet,
    pendingAction,
    runAction,
    ensureGlyphReady,
    openWalletDialog,
  } = useWalletSession();
  const [amount, setAmount] = useState("");
  const [amountInvalid, setAmountInvalid] = useState(false);
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

    let procedure;
    try {
      procedure = prepareLockQus(amount);
    } catch (reason) {
      setAmountInvalid(true);
      toast.error(
        reason instanceof Error
          ? reason.message
          : "Check the amount and try again.",
      );
      return;
    }
    setAmountInvalid(false);

    setWorking(true);
    try {
      const result = await runAction(
        procedure.label,
        () => {
          if (isGlyph) {
            return requestGlyphScCall({
              contractIndex: procedure.contractIndex,
              inputType: procedure.inputType,
              ...(procedure.payload
                ? { payload: payloadToBase64(procedure.payload) }
                : {}),
              amount: procedure.amount,
            });
          }
          return wallet.sendTransaction({
            destination: contractIndexToIdentity(procedure.contractIndex),
            inputType: procedure.inputType,
            ...(procedure.payload
              ? { payload: payloadToBase64(procedure.payload) }
              : {}),
            amount: procedure.amount,
          });
        },
        "The lock request was not completed. Check your wallet, then try again.",
      );
      if (result !== undefined) {
        toast.success("Lock request approved.", {
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
        aria-labelledby="lock-qus-title"
      >
        <header className="flow-heading">
          <h2 id="lock-qus-title">Lock QUs</h2>
          <p>Connect a wallet to lock QUs through QEarn.</p>
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
      aria-labelledby="lock-qus-title"
      aria-busy={busy}
    >
      <header className="flow-heading">
        <h2 id="lock-qus-title">Lock QUs</h2>
        <p>Choose the whole-QU amount to lock through QEarn.</p>
      </header>
      <form
        className="task-form contract-procedure-form"
        onSubmit={(event) => void submit(event)}
      >
        <label htmlFor="lock-qus-amount">
          Amount (QU)
          <input
            id="lock-qus-amount"
            inputMode="numeric"
            value={amount}
            disabled={busy}
            aria-invalid={amountInvalid || undefined}
            aria-describedby="lock-qus-amount-help"
            placeholder="1000000"
            autoComplete="off"
            onChange={(event) => {
              setAmount(event.target.value);
              setAmountInvalid(false);
            }}
          />
          <span className="field-help" id="lock-qus-amount-help">
            Whole QUs only. Your wallet shows the final request.
          </span>
        </label>
        <div className="form-actions task-action-stack">
          <Button type="submit" disabled={busy}>
            <LockKeyholeIcon aria-hidden="true" />
            {working ? "Opening wallet…" : "Lock QUs"}
          </Button>
        </div>
      </form>
    </section>
  );
}
