"use client";

import { useState } from "react";
import { useBalance } from "@qubic.org/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { connectorLabel } from "@/lib/connectors/availability";
import { useWalletSession } from "./wallet-session-provider";
import { Identicon } from "./identicon";

export function AccountDialog() {
  const { wallet, pendingAction, disconnect } = useWalletSession();
  const [open, setOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState("Copy identity");
  const identity = wallet.account?.identity;
  const balance = useBalance(open ? identity : null, { retry: 1 });
  if (!identity || !wallet.activeConnector) return null;
  async function copyIdentity() {
    try {
      await navigator.clipboard.writeText(identity!);
      setCopyStatus("Identity copied");
    } catch {
      setCopyStatus("Select the identity below to copy.");
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            className="identity-trigger"
            aria-label="Open account details"
          />
        }
      >
        <Identicon identity={identity} />
        <code>
          {identity.slice(0, 6)}…{identity.slice(-6)}
        </code>
      </DialogTrigger>
      <DialogContent className="wallet-dialog account-dialog">
        <DialogHeader>
          <DialogTitle>Account details</DialogTitle>
          <DialogDescription>
            {connectorLabel(wallet.activeConnector.id)} · Qubic mainnet
          </DialogDescription>
        </DialogHeader>
        <div className="account-profile">
          <Identicon identity={identity} size={64} />
          <strong>{wallet.account?.name || "Connected account"}</strong>
        </div>
        <div className="account-balance" aria-live="polite">
          <span className="data-label">Balance</span>
          {balance.data ? (
            <>
              <strong>{balance.data.balance.toLocaleString("en-US")} QU</strong>
              <span className="help-text">
                As of tick {balance.data.validForTick.toLocaleString("en-US")}
                {balance.isError ? " · Refresh unavailable" : ""}
              </span>
            </>
          ) : (
            <strong>
              {balance.isError ? "Balance unavailable" : "Loading balance…"}
            </strong>
          )}
          <Button
            variant="ghost"
            disabled={balance.isFetching}
            onClick={() => void balance.refetch()}
          >
            {balance.isFetching ? "Refreshing…" : "Refresh balance"}
          </Button>
        </div>
        <div className="account-identity">
          <span className="data-label">Public identity</span>
          <code>{identity}</code>
        </div>
        <div className="form-actions">
          <Button variant="outline" onClick={() => void copyIdentity()}>
            Copy identity
          </Button>
          <Button
            variant="outline"
            disabled={Boolean(pendingAction)}
            onClick={disconnect}
          >
            Disconnect
          </Button>
        </div>
        {copyStatus !== "Copy identity" && (
          <p className="help-text" role="status">
            {copyStatus}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
