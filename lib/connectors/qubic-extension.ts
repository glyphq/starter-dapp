import {
  extensionConnector,
  type TransactionRequest,
  type WalletConnector,
} from "@qubic.org/react";
import type { Identity } from "@qubic.org/types";

type ExtensionTransactionRequest = TransactionRequest & {
  from: Identity;
};

async function withActiveSender(
  transaction: TransactionRequest,
): Promise<ExtensionTransactionRequest> {
  const account = await extensionConnector.getAccount();
  if (!account)
    throw new Error(
      "Connect the Qubic extension before sending a transaction.",
    );

  return {
    ...transaction,
    from: account.identity,
  };
}

/**
 * The browser extension requires its active identity in transaction requests,
 * including smart-contract calls. Keep this compatibility detail local so the
 * rest of the starter speaks the shared WalletConnector contract.
 */
export const qubicExtensionConnector: WalletConnector = {
  ...extensionConnector,

  async sendTransaction(transaction) {
    return extensionConnector.sendTransaction(
      await withActiveSender(transaction),
    );
  },

  async signTransaction(transaction) {
    return extensionConnector.signTransaction(
      await withActiveSender(transaction),
    );
  },
};
