"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { connectorLabel } from "@/lib/connectors/availability";
import { useWalletSession } from "./wallet-session-provider";

export function AccountMenu() {
  const { wallet, pendingAction, disconnect } = useWalletSession();
  const [copyStatus, setCopyStatus] = useState("Copy identity");
  const identity = wallet.account?.identity;
  if (!identity || !wallet.activeConnector) return null;
  async function copyIdentity() {
    try {
      await navigator.clipboard.writeText(identity!);
      setCopyStatus("Identity copied");
    } catch {
      setCopyStatus("Copy unavailable. Select the identity below.");
    }
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            className="identity-trigger"
            aria-label="Open connected identity menu"
          />
        }
      >
        <span className="status-dot online" aria-hidden="true" />
        <code>
          {identity.slice(0, 6)}…{identity.slice(-6)}
        </code>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="identity-menu">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Connected identity</DropdownMenuLabel>
          <div className="identity-menu-details">
            <code>{identity}</code>
            <span>{connectorLabel(wallet.activeConnector.id)}</span>
          </div>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => void copyIdentity()}>
            {copyStatus}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={Boolean(pendingAction)}
            onClick={disconnect}
            variant="destructive"
          >
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
