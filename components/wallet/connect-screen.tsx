"use client";

import { ArrowRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { connectorLabel } from "@/lib/connectors/availability";
import { useWalletSession } from "./wallet-session-provider";
import { Identicon } from "./identicon";

export function ConnectScreen() {
  const { wallet, pendingAction, openWalletDialog } = useWalletSession();
  const connected = wallet.account && wallet.activeConnector;
  return (
    <section
      className="flow-panel connect-landing"
      aria-labelledby="connect-title"
    >
      <div className="connect-art" aria-hidden="true" />
      {connected && <Identicon identity={wallet.account!.identity} size={48} />}
      <div className="flow-heading">
        <h2 id="connect-title">
          {connected ? "You're connected." : "Start with your wallet."}
        </h2>
        <p>
          {connected
            ? `${connectorLabel(wallet.activeConnector!.id)} · Choose an example above.`
            : "Connect to try signatures and contract calls."}
        </p>
      </div>
      {!connected && (
        <Button onClick={openWalletDialog} disabled={Boolean(pendingAction)}>
          Choose wallet <ArrowRightIcon aria-hidden="true" />
        </Button>
      )}
      <p className="safety-note">Your keys stay in your wallet.</p>
    </section>
  );
}
