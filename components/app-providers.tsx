"use client";

import { QubicProvider, WalletProvider } from "@qubic.org/react";
import { createLiveClient } from "@qubic.org/rpc";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { RequestStatus } from "@/components/wallet/request-status";
import { WalletSessionProvider } from "@/components/wallet/wallet-session-provider";
import { connectors } from "@/lib/connectors";

const liveClient = createLiveClient();

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QubicProvider liveClient={liveClient}>
      <WalletProvider
        connectors={connectors}
        storageKey="glyph-starter-connector"
      >
        <WalletSessionProvider>
          <RequestStatus />
          {children}
          <Toaster closeButton position="bottom-right" />
        </WalletSessionProvider>
      </WalletProvider>
    </QubicProvider>
  );
}
