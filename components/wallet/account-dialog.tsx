"use client";

import { useState } from "react";
import { useBalance } from "@qubic.org/react";
import { CopyIcon, LogOutIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";
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
  const identity = wallet.account?.identity;
  const balance = useBalance(open ? identity : null, { retry: 1 });
  if (!identity || !wallet.activeConnector) return null;
  async function copyIdentity() {
    try {
      await navigator.clipboard.writeText(identity!);
      toast.success("Identity copied.", {
        icon: <Identicon identity={identity!} size={20} />,
      });
    } catch {
      toast.message("Select the identity below to copy it.");
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
          <div className="account-balance-heading">
            <span className="data-label">Balance</span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Refresh balance"
              title="Refresh balance"
              disabled={balance.isFetching}
              onClick={() => void balance.refetch()}
            >
              <RefreshCwIcon
                className={balance.isFetching ? "animate-spin" : undefined}
                aria-hidden="true"
              />
            </Button>
          </div>
          {balance.data ? (
            <strong>{balance.data.balance.toLocaleString("en-US")} QU</strong>
          ) : (
            <strong>
              {balance.isError ? "Balance unavailable" : "Loading balance…"}
            </strong>
          )}
        </div>
        <div className="account-identity">
          <div className="account-identity-heading">
            <span className="data-label">Public identity</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void copyIdentity()}
              aria-label="Copy identity"
            >
              <CopyIcon aria-hidden="true" />
              Copy
            </Button>
          </div>
          <code>{identity}</code>
        </div>
        <div className="account-actions">
          <Button
            variant="outline"
            size="sm"
            disabled={Boolean(pendingAction)}
            onClick={disconnect}
          >
            <LogOutIcon aria-hidden="true" />
            Disconnect
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
