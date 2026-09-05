import { afterEach, describe, expect, test } from "bun:test";
import { connectorAvailability, connectorLabel } from "./availability";

const originalOrigin = process.env.NEXT_PUBLIC_APP_ORIGIN;
afterEach(() => {
  if (originalOrigin === undefined) delete process.env.NEXT_PUBLIC_APP_ORIGIN;
  else process.env.NEXT_PUBLIC_APP_ORIGIN = originalOrigin;
});

describe("wallet setup states", () => {
  test("names supported connectors without hiding custom connector names", () => {
    expect(connectorLabel("glyph-wallet")).toBe("Glyph Wallet");
    expect(connectorLabel("custom-wallet")).toBe("custom-wallet");
  });
  test("explains missing WalletConnect setup before attempting detection", () => {
    let detected = false;
    const state = connectorAvailability(
      {
        id: "walletconnect",
        isAvailable: () => {
          detected = true;
          return true;
        },
      },
      false,
    );
    expect(state.available).toBe(false);
    expect(state.description).toContain("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID");
    expect(detected).toBe(false);
  });
  test("shows disabled setup guidance for missing extension or unsafe origin", () => {
    expect(
      connectorAvailability(
        { id: "qubic-extension", isAvailable: () => false },
        false,
      ).description,
    ).toContain("Install and enable");
    process.env.NEXT_PUBLIC_APP_ORIGIN = "http://localhost:3000";
    for (const id of ["glyph-wallet", "walletconnect"]) {
      const state = connectorAvailability(
        { id, isAvailable: () => true },
        true,
      );
      expect(state.available).toBe(false);
      expect(state.description).toContain("HTTPS");
    }
  });
  test("allows a configured connector and safely contains detection exceptions", () => {
    process.env.NEXT_PUBLIC_APP_ORIGIN = "https://dapp.example";
    expect(
      connectorAvailability(
        { id: "glyph-wallet", isAvailable: () => true },
        false,
      ).available,
    ).toBe(true);
    const state = connectorAvailability(
      {
        id: "custom-wallet",
        isAvailable: () => {
          throw new Error("private provider detail");
        },
      },
      false,
    );
    expect(state.available).toBe(false);
    expect(state.description).not.toContain("private provider detail");
  });
});
