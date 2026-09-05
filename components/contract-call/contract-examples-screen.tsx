"use client";

import { useMemo, useState, type FormEvent } from "react";
import { contractIndexToIdentity } from "@qubic.org/crypto";
import { useQubic } from "@qubic.org/react";
import { PlayIcon, SendIcon, WalletIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useWalletSession } from "@/components/wallet/wallet-session-provider";
import {
  payloadToBase64,
  prepareStarterContractProcedure,
  STARTER_CONTRACTS,
  starterContractAction,
  starterContractActionsFor,
  stringifyContractResult,
  type StarterActionId,
  type StarterContractId,
} from "@/lib/contracts/starter-contracts";
import { requestGlyphScCall } from "@/lib/connectors/glyph";

type ContractExamplesScreenProps = {
  initialContract: StarterContractId;
};

export function ContractExamplesScreen({
  initialContract,
}: ContractExamplesScreenProps) {
  const { liveClient } = useQubic();
  const {
    wallet,
    pendingAction,
    runAction,
    ensureGlyphReady,
    openWalletDialog,
  } = useWalletSession();
  const [contractId, setContractId] =
    useState<StarterContractId>(initialContract);
  const actionOptions = useMemo(
    () => starterContractActionsFor(contractId),
    [contractId],
  );
  const [actionId, setActionId] = useState<StarterActionId>(
    actionOptions[0]?.id ?? "qearn-stats",
  );
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const selectedAction =
    starterContractAction(actionId) ?? actionOptions[0] ?? null;
  const selectedContract = STARTER_CONTRACTS.find(
    (contract) => contract.id === contractId,
  );
  const connected = Boolean(wallet.account && wallet.activeConnector);
  const isGlyph = wallet.activeConnector?.id === "glyph-wallet";
  const busy = working || pendingAction !== null;
  const requiresWallet = selectedAction?.kind === "procedure";

  function selectContract(nextContractId: StarterContractId) {
    const nextAction = starterContractActionsFor(nextContractId)[0];
    setContractId(nextContractId);
    setActionId(nextAction?.id ?? "qearn-stats");
    setValues({});
    setResult(null);
  }

  function selectAction(nextActionId: StarterActionId) {
    setActionId(nextActionId);
    setValues({});
    setResult(null);
  }

  async function runQuery() {
    if (!selectedAction || selectedAction.kind !== "query" || busy) return;
    setWorking(true);
    setResult(null);
    try {
      const response = await selectedAction.run(liveClient);
      if (!response.ok) {
        toast.error("The network did not return a result. Try again.");
        return;
      }
      setResult(stringifyContractResult(response.value));
      toast.success(`${selectedAction.label} loaded.`);
    } catch {
      toast.error("The network did not return a result. Try again.");
    } finally {
      setWorking(false);
    }
  }

  async function submitProcedure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedAction || selectedAction.kind !== "procedure" || busy) return;
    const account = wallet.account;
    if (!account || !wallet.activeConnector) {
      openWalletDialog();
      return;
    }
    if (isGlyph && !ensureGlyphReady()) {
      return;
    }

    setResult(null);
    let procedure;
    try {
      procedure = prepareStarterContractProcedure(
        selectedAction.id,
        values,
        account.identity,
      );
    } catch (reason) {
      toast.error(
        reason instanceof Error
          ? reason.message
          : "Check the procedure inputs.",
      );
      return;
    }

    setWorking(true);
    try {
      const submission = await runAction(
        procedure.label,
        () => {
          if (isGlyph) {
            return requestGlyphScCall({
              contractIndex: procedure.contractIndex,
              inputType: procedure.inputType,
              ...(procedure.payload
                ? { payload: payloadToBase64(procedure.payload) }
                : {}),
              amount: procedure.amount,
            });
          }
          return wallet.sendTransaction({
            destination: contractIndexToIdentity(procedure.contractIndex),
            inputType: procedure.inputType,
            ...(procedure.payload
              ? { payload: payloadToBase64(procedure.payload) }
              : {}),
            amount: procedure.amount,
          });
        },
        "The contract request was not completed. Check your wallet, then try again.",
      );
      if (submission !== undefined) {
        toast.success("Contract request approved.");
      }
    } finally {
      setWorking(false);
    }
  }

  return (
    <section
      className="flow-panel contract-examples-screen"
      aria-labelledby="contract-examples-title"
      aria-busy={busy}
    >
      <header className="flow-heading">
        <h2 id="contract-examples-title">{selectedContract?.label}</h2>
        <p>{selectedContract?.description}</p>
      </header>

      <div className="task-form contract-example-selector">
        <label htmlFor="starter-contract-selector">
          Contract
          <select
            id="starter-contract-selector"
            value={contractId}
            disabled={busy}
            onChange={(event) =>
              selectContract(event.target.value as StarterContractId)
            }
          >
            {STARTER_CONTRACTS.map((contract) => (
              <option key={contract.id} value={contract.id}>
                {contract.label}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="starter-contract-action-selector">
          Action
          <select
            id="starter-contract-action-selector"
            value={selectedAction?.id ?? ""}
            disabled={busy}
            onChange={(event) =>
              selectAction(event.target.value as StarterActionId)
            }
          >
            {actionOptions.map((action) => (
              <option key={action.id} value={action.id}>
                {action.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selectedAction && (
        <p className="help-text contract-action-note">
          {selectedAction.description}
        </p>
      )}

      {requiresWallet && !connected ? (
        <div className="form-actions task-action-stack">
          <Button type="button" onClick={openWalletDialog} disabled={busy}>
            <WalletIcon aria-hidden="true" />
            Connect wallet
          </Button>
        </div>
      ) : selectedAction?.kind === "query" ? (
        <div className="form-actions task-action-stack">
          <Button onClick={() => void runQuery()} disabled={busy}>
            <PlayIcon aria-hidden="true" />
            {working ? "Loading…" : `Run ${selectedAction.label}`}
          </Button>
        </div>
      ) : selectedAction?.kind === "procedure" ? (
        <form
          className="task-form contract-procedure-form"
          onSubmit={(event) => void submitProcedure(event)}
        >
          {selectedAction.fields.map((field) => (
            <label key={field.id} htmlFor={`procedure-${field.id}`}>
              {field.label}
              <input
                id={`procedure-${field.id}`}
                inputMode={field.inputMode}
                value={values[field.id] ?? ""}
                disabled={busy}
                placeholder={field.placeholder}
                autoComplete="off"
                onChange={(event) => {
                  setValues((current) => ({
                    ...current,
                    [field.id]: event.target.value,
                  }));
                }}
              />
              {field.help && <span className="field-help">{field.help}</span>}
            </label>
          ))}
          <div className="form-actions task-action-stack">
            <Button type="submit" disabled={busy}>
              <SendIcon aria-hidden="true" />
              {working ? "Opening wallet…" : selectedAction.label}
            </Button>
          </div>
        </form>
      ) : null}

      {result && (
        <div className="contract-call-result" role="status" aria-live="polite">
          <span className="data-label">Result</span>
          <pre>{result}</pre>
        </div>
      )}
    </section>
  );
}
