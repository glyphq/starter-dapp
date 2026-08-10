"use client";

import { QubicProvider, WalletProvider } from "@qubic.org/react";
import { createLiveClient } from "@qubic.org/rpc";
import { SolarProvider } from "@solar-icons/react";
import type { ReactNode } from "react";
import { connectors } from "@/lib/connectors";

const liveClient = createLiveClient();

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SolarProvider value={{ weight: "Linear" }}>
      <QubicProvider liveClient={liveClient}>
        <WalletProvider connectors={connectors} storageKey="glyph-starter-connector">
          {children}
        </WalletProvider>
      </QubicProvider>
    </SolarProvider>
  );
}
