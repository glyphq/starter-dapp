import type { WalletConnector } from "@qubic.org/react";
import { glyphConnector } from "./glyph";
import { getGlyphAppOrigin } from "./glyph-origin";
import { qubicExtensionConnector } from "./qubic-extension";
import { createStarterWalletConnectConnector } from "./wallet-connect";

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

const walletConnectConnector = createStarterWalletConnectConnector({
  createClient: async () => {
    if (!walletConnectProjectId) {
      throw new Error(
        "Add NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to enable WalletConnect.",
      );
    }
    const { default: SignClient } = await import("@walletconnect/sign-client");
    return SignClient.init({
      projectId: walletConnectProjectId,
      metadata: {
        name: "Glyph Qubic Starter",
        description: "A multi-wallet starter application for Qubic.",
        url: getGlyphAppOrigin(),
        icons: [],
      },
    });
  },
});

export const connectors: WalletConnector[] = [
  glyphConnector,
  qubicExtensionConnector,
  walletConnectConnector,
];

export const hasWalletConnectProjectId = Boolean(walletConnectProjectId);
