import { getGlyphAppOrigin } from "./glyph-origin";

export function connectorLabel(id: string) {
  return (
    (
      {
        "glyph-wallet": "Glyph Wallet",
        "qubic-extension": "Qubic Extension",
        walletconnect: "WalletConnect",
      } as Record<string, string>
    )[id] ?? id
  );
}

/** Only registered connectors are described; unavailable is different from absent. */
export function connectorAvailability(
  connector: { id: string; isAvailable: () => boolean },
  walletConnectConfigured: boolean,
): { available: boolean; description: string } {
  if (connector.id === "walletconnect" && !walletConnectConfigured) {
    return {
      available: false,
      description:
        "Add NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to enable QR pairing.",
    };
  }
  if (connector.id === "glyph-wallet" || connector.id === "walletconnect") {
    try {
      getGlyphAppOrigin();
    } catch {
      return {
        available: false,
        description:
          "Requires a public HTTPS origin. Use an HTTPS deployment or tunnel; any NEXT_PUBLIC_APP_ORIGIN override must match this page.",
      };
    }
  }
  try {
    if (!connector.isAvailable()) {
      return {
        available: false,
        description:
          connector.id === "qubic-extension"
            ? "Install and enable a Qubic browser extension, then refresh."
            : "This connector is not available in this browser.",
      };
    }
  } catch {
    return {
      available: false,
      description:
        "This connector could not be detected. Refresh and try again.",
    };
  }
  return {
    available: true,
    description:
      connector.id === "glyph-wallet"
        ? "Prepare a secure session, then open the desktop wallet."
        : connector.id === "walletconnect"
          ? "Pair with a compatible wallet using a QR code."
          : "Connect using your browser wallet.",
  };
}
