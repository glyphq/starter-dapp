import { afterEach, describe, expect, test } from "bun:test";
import { qubicExtensionConnector } from "./qubic-extension";

const originalQubic = (globalThis as typeof globalThis & { qubic?: unknown })
  .qubic;

function restoreQubic() {
  const host = globalThis as typeof globalThis & { qubic?: unknown };
  if (originalQubic === undefined) delete host.qubic;
  else host.qubic = originalQubic;
}

afterEach(restoreQubic);

describe("starter Qubic extension connector", () => {
  test("adds the active sender to a smart-contract transaction", async () => {
    const requests: unknown[] = [];
    (
      globalThis as typeof globalThis & {
        qubic?: unknown;
      }
    ).qubic = {
      isQubic: true,
      connect: async () => ({ connected: true, origin: "fixture" }),
      getAccount: async () => ({
        identity: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVKHO",
      }),
      disconnect: async () => ({ disconnected: true }),
      sendTransaction: async (request: unknown) => {
        requests.push(request);
        return {
          txId: "fixture-transaction",
          targetTick: 123,
          txBytesBase64: "",
          txBytesHex: "",
          networkTxId: "fixture-network-transaction",
          broadcast: {},
        };
      },
      signTransaction: async () => ({
        txId: "fixture-transaction",
        targetTick: 123,
        txBytesBase64: "",
        txBytesHex: "",
      }),
      signMessage: async () => ({ signatureHex: "", digestHex: "" }),
      on: () => () => {},
      off: () => {},
    };

    await qubicExtensionConnector.sendTransaction({
      destination:
        "JAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVKHO",
      amount: "1000000",
      inputType: 1,
    });

    expect(requests).toEqual([
      {
        from: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVKHO",
        destination:
          "JAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVKHO",
        amount: "1000000",
        inputType: 1,
      },
    ]);
  });
});
