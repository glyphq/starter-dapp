"use client";

import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { hasWalletConnectProjectId } from "@/lib/connectors";
import {
  connectorAvailability,
  connectorLabel,
} from "@/lib/connectors/availability";
import { useWalletSession } from "./wallet-session-provider";
import { LoadingIcon, RequestStatus } from "./request-status";

export function WalletDialog() {
  const {
    wallet,
    dialogOpen,
    setDialogOpen,
    pendingAction,
    pairingUri,
    connect,
  } = useWalletSession();
  // Client-only availability is evaluated on a deliberate open, not during SSR.
  if (!dialogOpen) return null;
  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="wallet-dialog">
        <DialogHeader>
          <DialogTitle>Connect a wallet</DialogTitle>
          <DialogDescription>
            Choose how to connect. Your keys never leave your wallet.
          </DialogDescription>
        </DialogHeader>
        <div className="connector-list">
          {wallet.connectors.map((connector) => {
            const availability = connectorAvailability(
              connector,
              hasWalletConnectProjectId,
            );
            const glyph = connector.id === "glyph-wallet";
            return (
              <button
                type="button"
                disabled={!availability.available || Boolean(pendingAction)}
                onClick={() => connect(connector.id)}
                aria-label={
                  availability.available
                    ? `Connect ${connectorLabel(connector.id)}`
                    : `${connectorLabel(connector.id)} unavailable`
                }
                className={`wallet-option ${availability.available ? "" : "is-unavailable"}`}
                key={connector.id}
              >
                <span className="wallet-option-heading">
                  {glyph && (
                    <Image
                      className="glyph-mark"
                      src="/brand/glyph-mark.png"
                      alt=""
                      width={24}
                      height={24}
                    />
                  )}
                  <strong>{connectorLabel(connector.id)}</strong>
                  <span className="availability-label">
                    {availability.available ? "Available" : "Setup required"}
                  </span>
                </span>
                <span className="wallet-option-description">
                  {availability.description}
                </span>
                {pendingAction && availability.available ? (
                  <LoadingIcon />
                ) : null}
              </button>
            );
          })}
          {wallet.connectors.length === 0 && (
            <p className="notice">
              No wallets are configured. Register a connector in
              lib/connectors/index.ts.
            </p>
          )}
        </div>
        {pairingUri && (
          <div className="pairing-box">
            <QRCodeSVG
              value={pairingUri}
              size={180}
              bgColor="#ffffff"
              fgColor="#172019"
              marginSize={3}
            />
            <p>
              Scan with your WalletConnect wallet. This pairing code is private.
            </p>
          </div>
        )}
        <RequestStatus />
        {pendingAction && (
          <p className="help-text">
            Closing this dialog does not cancel a request already sent to your
            wallet.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
