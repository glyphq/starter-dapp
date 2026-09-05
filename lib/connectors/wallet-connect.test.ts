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
  const identity =
    "FXHSWSJBTCZHFAFXHSWSJBTCZHFAFXHSWSJBTCZHFAFXHSWSJBTCZHFAYKSC";

  test("sends the active identity with signing and transaction requests", async () => {
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
                accounts: [`qubic:mainnet:${identity}`],
                methods: [
                  "qubic_requestAccounts",
                  "qubic_signTransaction",
                  "qubic_sendQubic",
                  "qubic_sign",
                ],
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
    await connector.sendTransaction({
      destination:
        "JAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVKHO",
      amount: "1000000",
      inputType: 1,
    });
    await connector.signTransaction({
      destination:
        "JAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVKHO",
      amount: "1000000",
      inputType: 1,
    });
    expect(requests).toEqual([
      {
        topic: "fixture-topic",
        chainId: "qubic:mainnet",
        request: {
          method: "qubic_sign",
          params: {
            from: identity,
            message: "Map-shaped signing message",
          },
        },
      },
      {
        topic: "fixture-topic",
        chainId: "qubic:mainnet",
        request: {
          method: "qubic_sendQubic",
          params: {
            from: identity,
            destination:
              "JAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVKHO",
            amount: "1000000",
            inputType: 1,
          },
        },
      },
      {
        topic: "fixture-topic",
        chainId: "qubic:mainnet",
        request: {
          method: "qubic_signTransaction",
          params: {
            from: identity,
            destination:
              "JAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVKHO",
            amount: "1000000",
            inputType: 1,
          },
        },
      },
    ]);
  });

  test("rejects sessions without all requested capabilities", async () => {
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    });

    const connector = createStarterWalletConnectConnector({
      createClient: async () => ({
        connect: async () => ({
          approval: async () => ({
            topic: "invalid-topic",
            namespaces: {
              qubic: {
                accounts: [`qubic:mainnet:${identity}`],
                methods: [],
                events: [],
              },
            },
          }),
        }),
        disconnect: async () => {},
        request: async <T>() => [] as T,
        session: { get: () => undefined },
        on: () => {},
        off: () => {},
      }),
    });

    await expect(connector.connect()).rejects.toThrow(
      "WalletConnect: no account in session namespaces",
    );
    expect(values.get("qubic-wc-session")).toBeUndefined();
  });

  test("rejects non-mainnet or malformed session identities", async () => {
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    });

    const connector = createStarterWalletConnectConnector({
      createClient: async () => ({
        connect: async () => ({
          approval: async () => ({
            topic: "invalid-account-topic",
            namespaces: {
              qubic: {
                accounts: ["qubic:testnet:not-an-identity"],
                methods: [
                  "qubic_requestAccounts",
                  "qubic_signTransaction",
                  "qubic_sendQubic",
                  "qubic_sign",
                ],
                events: [],
              },
            },
          }),
        }),
        disconnect: async () => {},
        request: async <T>() => [] as T,
        session: { get: () => undefined },
        on: () => {},
        off: () => {},
      }),
    });

    await expect(connector.connect()).rejects.toThrow(
      "WalletConnect: no account in session namespaces",
    );
    expect(values.get("qubic-wc-session")).toBeUndefined();
  });
});
