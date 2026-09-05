import type {
  ConnectOptions,
  SendTransactionResult,
  SignMessageResult,
  SignTransactionResult,
  TransactionRequest,
  WalletAccount,
  WalletConnector,
  WalletConnectorEvent,
} from "@qubic.org/react";
import type { Identity } from "@qubic.org/types";

type WalletConnectNamespace = {
  accounts: string[];
  methods: string[];
  events: string[];
};

type WalletConnectSession = {
  topic: string;
  namespaces: {
    qubic?: WalletConnectNamespace;
  };
};

type WalletConnectClient = {
  connect(options: {
    requiredNamespaces: Record<
      string,
      { chains: string[]; methods: string[]; events: string[] }
    >;
  }): Promise<{ uri?: string; approval(): Promise<WalletConnectSession> }>;
  disconnect(options: {
    topic: string;
    reason: { code: number; message: string };
  }): Promise<void>;
  request<T>(options: {
    topic: string;
    chainId: string;
    request: { method: string; params: unknown };
  }): Promise<T>;
  session: { get(topic: string): WalletConnectSession | undefined };
  on(event: string, callback: () => void): void;
  off(event: string, callback: () => void): void;
};

type WalletConnectAccount = {
  address: string;
  alias?: string;
};

type WalletConnectConnectorOptions = {
  createClient: () => Promise<WalletConnectClient>;
  chainId?: string;
  sessionStorageKey?: string;
};

const walletConnectMethods = {
  requestAccounts: "qubic_requestAccounts",
  signTransaction: "qubic_signTransaction",
  sendTransaction: "qubic_sendQubic",
  sign: "qubic_sign",
} as const;

type EventCallback = (...args: unknown[]) => void;

/**
 * Qubic WalletConnect connector with the wallet's map-shaped `qubic_sign`
 * parameter. The upstream 1.0 connector sends the message string directly,
 * which Qubic Wallet rejects as a String instead of Map<String, dynamic>.
 */
export function createStarterWalletConnectConnector(
  options: WalletConnectConnectorOptions,
): WalletConnector {
  const chainId = options.chainId ?? "qubic:mainnet";
  const sessionKey = options.sessionStorageKey ?? "qubic-wc-session";
  const listeners = new Map<WalletConnectorEvent, Set<EventCallback>>();
  let clientPromise: Promise<WalletConnectClient> | null = null;

  function emit(event: WalletConnectorEvent, payload?: unknown) {
    for (const callback of listeners.get(event) ?? []) callback(payload);
  }

  function getSavedTopic() {
    try {
      return localStorage.getItem(sessionKey);
    } catch {
      return null;
    }
  }

  function saveTopic(topic: string) {
    try {
      localStorage.setItem(sessionKey, topic);
    } catch {
      // Session restoration is a convenience, not a connection requirement.
    }
  }

  function clearSavedTopic() {
    try {
      localStorage.removeItem(sessionKey);
    } catch {
      // The remote session can still be disconnected when storage is unavailable.
    }
  }

  async function getClient() {
    if (!clientPromise) {
      clientPromise = options
        .createClient()
        .then((client) => {
          const clearSession = () => {
            clearSavedTopic();
            emit("disconnect");
          };
          client.on("session_delete", clearSession);
          client.on("session_expire", clearSession);
          return client;
        })
        .catch((error: unknown) => {
          clientPromise = null;
          throw error;
        });
    }
    return clientPromise;
  }

  function accountFromSession(
    session: WalletConnectSession,
  ): WalletAccount | null {
    const account = session.namespaces.qubic?.accounts[0];
    const identity = account?.split(":").at(-1);
    return identity ? { identity: identity as Identity } : null;
  }

  async function request<T>(method: string, params: unknown) {
    const topic = getSavedTopic();
    if (!topic) throw new Error("WalletConnect: not connected");
    return (await getClient()).request<T>({
      topic,
      chainId,
      request: { method, params },
    });
  }

  return {
    id: "walletconnect",
    isAvailable: () => true,

    async connect(connectOptions?: ConnectOptions) {
      const savedTopic = getSavedTopic();
      if (savedTopic) {
        const session = (await getClient()).session.get(savedTopic);
        if (session) {
          const account = accountFromSession(session);
          if (account) return account;
        }
        clearSavedTopic();
      }

      const client = await getClient();
      const { uri, approval } = await client.connect({
        requiredNamespaces: {
          qubic: {
            chains: [chainId],
            methods: Object.values(walletConnectMethods),
            events: ["accountsChanged", "amountChanged"],
          },
        },
      });
      if (uri) connectOptions?.onUri?.(uri);

      const session = await approval();
      saveTopic(session.topic);
      const account = accountFromSession(session);
      if (!account)
        throw new Error("WalletConnect: no account in session namespaces");
      return account;
    },

    async getAccount() {
      const topic = getSavedTopic();
      if (!topic) return null;
      try {
        const accounts = await request<WalletConnectAccount[]>(
          walletConnectMethods.requestAccounts,
          { nonce: Date.now().toString() },
        );
        const account = accounts[0];
        if (!account) return null;
        return {
          identity: account.address as Identity,
          ...(account.alias ? { name: account.alias } : {}),
        };
      } catch {
        return null;
      }
    },

    async disconnect() {
      const topic = getSavedTopic();
      clearSavedTopic();
      if (!topic) return;
      try {
        await (
          await getClient()
        ).disconnect({
          topic,
          reason: { code: 6000, message: "User disconnected" },
        });
      } catch {
        // The local account should still be cleared if the remote session expired.
      }
    },

    sendTransaction: (transaction: TransactionRequest) =>
      request<SendTransactionResult>(
        walletConnectMethods.sendTransaction,
        transaction,
      ),

    signTransaction: (transaction: TransactionRequest) =>
      request<SignTransactionResult>(
        walletConnectMethods.signTransaction,
        transaction,
      ),

    signMessage: (message: string) =>
      request<SignMessageResult>(walletConnectMethods.sign, { message }),

    on(event, callback) {
      const callbacks = listeners.get(event) ?? new Set<EventCallback>();
      callbacks.add(callback);
      listeners.set(event, callbacks);
      return () => callbacks.delete(callback);
    },
  };
}
