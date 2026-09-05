"use client";

import Image from "next/image";
import {
  ArrowRightIcon,
  PuzzleIcon,
  QrCodeIcon,
} from "lucide-react";
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
import { LoadingIcon } from "./request-status";

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
  const visibleConnectors = wallet.connectors.filter(
    (connector) =>
      connector.id === "qubic-extension" ||
      connectorAvailability(connector, hasWalletConnectProjectId).available,
  );
  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="wallet-dialog">
        <DialogHeader>
          <DialogTitle>Connect a wallet</DialogTitle>
          <DialogDescription>
            Your wallet, your way. Choose one to get started.
          </DialogDescription>
        </DialogHeader>
        <div className="connector-list">
          {visibleConnectors.map((connector) => {
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
                  <span className="provider-symbol" aria-hidden="true">
                    {glyph ? (
                      <Image
                        className="glyph-mark"
                        src="/brand/glyph-mark.png"
                        alt=""
                        width={26}
                        height={26}
                      />
                    ) : connector.id === "walletconnect" ? (
                      <QrCodeIcon size={24} />
                    ) : (
                      <PuzzleIcon size={24} />
                    )}
                  </span>
                  <strong>{connectorLabel(connector.id)}</strong>
                  <span className="provider-action" aria-hidden="true">
                    {availability.available ? (
                      <ArrowRightIcon size={18} />
                    ) : (
                      <span className="provider-unavailable-dot" />
                    )}
                  </span>
                </span>
                {pendingAction && availability.available ? (
                  <LoadingIcon />
                ) : null}
              </button>
            );
          })}
          {visibleConnectors.length === 0 && (
            <p className="notice">No wallets available.</p>
          )}
        </div>
        <p className="chooser-safety">
          Your keys stay in your wallet. You approve every request.
        </p>
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
