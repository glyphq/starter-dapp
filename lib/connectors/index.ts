import {
  createWalletConnectConnector,
  extensionConnector,
  type WalletConnector,
} from "@qubic.org/react";
import { glyphConnector } from "./glyph";

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

const walletConnectConnector = createWalletConnectConnector({
  createClient: async () => {
    if (!walletConnectProjectId) {
      throw new Error("Add NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to enable WalletConnect.");
    }
    const { default: SignClient } = await import("@walletconnect/sign-client");
    return SignClient.init({
      projectId: walletConnectProjectId,
      metadata: {
        name: "Glyph Qubic Starter",
        description: "A multi-wallet starter application for Qubic.",
        url: process.env.NEXT_PUBLIC_APP_ORIGIN ?? "https://starter.glyphq.org",
        icons: [],
      },
    });
  },
});

export const connectors: WalletConnector[] = [
  glyphConnector,
  extensionConnector,
  walletConnectConnector,
];

export const hasWalletConnectProjectId = Boolean(walletConnectProjectId);
;
