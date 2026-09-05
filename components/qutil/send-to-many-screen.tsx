"use client";

import { useState, type FormEvent } from "react";
import { PlusIcon, SendIcon, Trash2Icon, WalletIcon } from "lucide-react";
import { toast } from "sonner";
import { contractIndexToIdentity } from "@qubic.org/crypto";
import { Button } from "@/components/ui/button";
import { Identicon } from "@/components/wallet/identicon";
import { useWalletSession } from "@/components/wallet/wallet-session-provider";
import { requestGlyphScCall } from "@/lib/connectors/glyph";
import {
  payloadToBase64,
  prepareSendToMany,
  type SendToManyRecipient,
} from "@/lib/contracts/starter-procedures";

const maximumRecipients = 10;

function emptyRecipient(): SendToManyRecipient {
  return { destination: "", amount: "" };
}

export function SendToManyScreen() {
  const {
    wallet,
    pendingAction,
    runAction,
    ensureGlyphReady,
    openWalletDialog,
  } = useWalletSession();
  const [recipients, setRecipients] = useState<SendToManyRecipient[]>([
    emptyRecipient(),
  ]);
  const [completedRecipients, setCompletedRecipients] = useState(0);
  const [working, setWorking] = useState(false);
  const connected = Boolean(wallet.account && wallet.activeConnector);
  const isGlyph = wallet.activeConnector?.id === "glyph-wallet";
  const busy = working || pendingAction !== null;
  const identity = wallet.account?.identity;
  const allRecipientsSent = completedRecipients >= recipients.length;
  const nextRecipient = completedRecipients + 1;

  function updateRecipient(
    index: number,
    field: keyof SendToManyRecipient,
    value: string,
  ) {
    setRecipients((current) =>
      current.map((recipient, recipientIndex) =>
        recipientIndex === index ? { ...recipient, [field]: value } : recipient,
      ),
    );
    setCompletedRecipients(0);
  }

  function addRecipient() {
    if (busy || recipients.length >= maximumRecipients) return;
    setRecipients((current) => [...current, emptyRecipient()]);
    setCompletedRecipients(0);
  }

  function removeRecipient(index: number) {
    if (busy || recipients.length === 1) return;
    setRecipients((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    );
    setCompletedRecipients(0);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || allRecipientsSent) return;
    if (!wallet.account || !wallet.activeConnector) {
      openWalletDialog();
      return;
    }
    if (isGlyph && !ensureGlyphReady()) return;

    let procedures;
    try {
      procedures = prepareSendToMany(recipients);
    } catch (reason) {
      toast.error(
        reason instanceof Error
          ? reason.message
          : "Check the recipients and amounts, then try again.",
      );
      return;
    }

    const procedure = procedures[completedRecipients];
    if (!procedure) return;

    setWorking(true);
    try {
      const result = await runAction(
        procedure.label,
        () => {
          const payload = procedure.payload
            ? payloadToBase64(procedure.payload)
            : undefined;
          if (isGlyph) {
            return requestGlyphScCall({
              contractIndex: procedure.contractIndex,
              inputType: procedure.inputType,
              ...(payload ? { payload } : {}),
              amount: procedure.amount,
            });
          }
          return wallet.sendTransaction({
            destination: contractIndexToIdentity(procedure.contractIndex),
            inputType: procedure.inputType,
            ...(payload ? { payload } : {}),
            amount: procedure.amount,
          });
        },
        "The QUtil procedure was not completed. Check your wallet, then try again.",
      );
      if (result !== undefined) {
        setCompletedRecipients((current) => current + 1);
        toast.success(
          `QUtil procedure ${nextRecipient} of ${procedures.length} approved.`,
          {
            icon: identity ? (
              <Identicon identity={identity} size={20} />
            ) : undefined,
          },
        );
      }
    } finally {
      setWorking(false);
    }
  }

  if (!connected) {
    return (
      <section
        className="flow-panel procedure-screen"
        aria-labelledby="send-to-many-title"
      >
        <header className="flow-heading">
          <h2 id="send-to-many-title">Send to many</h2>
          <p>Connect a wallet to prepare a QUtil SendToMany V1 procedure.</p>
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
      aria-labelledby="send-to-many-title"
      aria-busy={busy}
    >
      <header className="flow-heading">
        <h2 id="send-to-many-title">Send to many</h2>
        <p>
          QUtil SendToMany V1 procedure. Add recipients, then approve each call.
        </p>
      </header>
      <form
        className="task-form contract-procedure-form"
        onSubmit={(event) => void submit(event)}
      >
        <div className="recipient-list">
          {recipients.map((recipient, index) => (
            <fieldset className="recipient-entry" key={index}>
              <legend>Recipient {index + 1}</legend>
              {recipients.length > 1 && (
                <Button
                  className="recipient-remove"
                  variant="ghost"
                  size="icon-sm"
                  type="button"
                  aria-label={`Remove recipient ${index + 1}`}
                  title={`Remove recipient ${index + 1}`}
                  disabled={busy}
                  onClick={() => removeRecipient(index)}
                >
                  <Trash2Icon aria-hidden="true" />
                </Button>
              )}
              <label htmlFor={`send-to-many-recipient-${index}`}>
                Qubic identity
                <input
                  id={`send-to-many-recipient-${index}`}
                  value={recipient.destination}
                  disabled={busy}
                  placeholder="Qubic identity"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  onChange={(event) =>
                    updateRecipient(index, "destination", event.target.value)
                  }
                />
              </label>
              <label htmlFor={`send-to-many-amount-${index}`}>
                Amount (QU)
                <input
                  id={`send-to-many-amount-${index}`}
                  inputMode="numeric"
                  value={recipient.amount}
                  disabled={busy}
                  placeholder="1000000"
                  autoComplete="off"
                  onChange={(event) =>
                    updateRecipient(index, "amount", event.target.value)
                  }
                />
              </label>
            </fieldset>
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          disabled={busy || recipients.length >= maximumRecipients}
          onClick={addRecipient}
        >
          <PlusIcon aria-hidden="true" />
          Add recipient
        </Button>
        <div className="form-actions task-action-stack">
          <Button type="submit" disabled={busy || allRecipientsSent}>
            <SendIcon aria-hidden="true" />
            {working
              ? "Opening wallet…"
              : allRecipientsSent
                ? "All QUtil calls approved"
                : `Approve QUtil call ${nextRecipient} of ${recipients.length}`}
          </Button>
        </div>
      </form>
    </section>
  );
}
