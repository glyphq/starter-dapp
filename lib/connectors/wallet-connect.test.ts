import { afterEach, describe, expect, test } from "bun:test";
import { createStarterWalletConnectConnector } from "./wallet-connect";

const originalLocalStorage = globalThis.localStorage;

afterEach(() => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: originalLocalStorage,
  });
});

describe("starter WalletConnect connector", () => {
  test("sends qubic_sign with the map-shaped message parameter Qubic Wallet expects", async () => {
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    });

    const requests: unknown[] = [];
    const connector = createStarterWalletConnectConnector({
      createClient: async () => ({
        connect: async () => ({
          approval: async () => ({
            topic: "fixture-topic",
            namespaces: {
              qubic: {
                accounts: ["qubic:mainnet:A".repeat(1)],
                methods: [],
                events: [],
              },
            },
          }),
        }),
        disconnect: async () => {},
        request: async <T>(request: unknown) => {
          requests.push(request);
          return {
            signatureHex: "ab".repeat(64),
            digestHex: "cd".repeat(32),
          } as T;
        },
        session: { get: () => undefined },
        on: () => {},
        off: () => {},
      }),
    });

    await connector.connect();
    await expect(
      connector.signMessage("Map-shaped signing message"),
    ).resolves.toEqual({
      signatureHex: "ab".repeat(64),
      digestHex: "cd".repeat(32),
    });
    expect(requests).toEqual([
      {
        topic: "fixture-topic",
        chainId: "qubic:mainnet",
        request: {
          method: "qubic_sign",
          params: { message: "Map-shaped signing message" },
        },
      },
    ]);
  });
});
